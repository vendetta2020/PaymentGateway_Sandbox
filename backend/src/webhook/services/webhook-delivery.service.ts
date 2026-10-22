import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { MerchantWebhookConfig } from '../entities/webhook-config.entity';
import { WebhookEvent } from '../entities/webhook-event.entity';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';
import * as http from 'http';
import * as https from 'https';
import { MetricsService } from '../../common/metrics/metrics.service';

export function computeWebhookSignature(
  secret: string,
  timestamp: string,
  rawPayload: string,
): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${rawPayload}`).digest('hex');
}

export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  rawPayload: string,
  signature: string,
  toleranceSeconds: number = 300,
): boolean {
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);

  if (isNaN(ts) || Math.abs(now - ts) > toleranceSeconds) {
    return false;
  }

  const expected = computeWebhookSignature(secret, timestamp, rawPayload);
  if (expected.length !== signature.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);
  public static readonly MAX_ATTEMPTS = 5;

  // Backoff schedule in milliseconds for attempts 1 through 5
  public static readonly BACKOFF_SCHEDULE_MS = [
    60 * 1000, // Attempt 1 -> 1 minute
    5 * 60 * 1000, // Attempt 2 -> 5 minutes
    15 * 60 * 1000, // Attempt 3 -> 15 minutes
    30 * 60 * 1000, // Attempt 4 -> 30 minutes
    60 * 60 * 1000, // Attempt 5 -> 60 minutes
  ];

  constructor(
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    private readonly configService: ConfigService,
    @Optional()
    private readonly metricsService?: MetricsService,
  ) {}

  private isPrivateOrLocalIp(ip: string): boolean {
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    if (ip.includes('.')) {
      if (ip.startsWith('127.')) return true;
      if (ip.startsWith('10.')) return true;
      if (ip.startsWith('192.168.')) return true;
      if (ip.startsWith('169.254.')) return true;
      if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
      if (ip === '0.0.0.0') return true;
      return false;
    }

    const ipLower = ip.toLowerCase();
    if (ipLower === '::1') return true;
    if (ipLower.startsWith('fc') || ipLower.startsWith('fd')) return true;
    if (
      ipLower.startsWith('fe8') ||
      ipLower.startsWith('fe9') ||
      ipLower.startsWith('fea') ||
      ipLower.startsWith('feb')
    )
      return true;

    return false;
  }

  /**
   * SSRF Protection: Validates protocol and rejects private/internal IPs
   * unless ALLOW_DEV_LOCAL_WEBHOOKS is explicitly enabled in dev/test.
   * Returns the resolved IP address to ensure TOCTOU safety by pinning it.
   */
  async validateUrlSecurity(
    urlString: string,
  ): Promise<{ isValid: boolean; reason?: string; pinnedIp?: string }> {
    try {
      const parsed = new URL(urlString);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, reason: 'Unsupported protocol. Only http/https allowed.' };
      }

      const allowLocal = Boolean(this.configService.get<boolean>('ALLOW_DEV_LOCAL_WEBHOOKS'));
      const hostname = parsed.hostname.toLowerCase();

      const isCloudMetadata =
        hostname === '169.254.169.254' ||
        hostname === 'metadata.google.internal' ||
        (hostname.endsWith('.internal') && (!allowLocal || hostname !== 'host.docker.internal'));

      if (isCloudMetadata) {
        return { isValid: false, reason: 'SSRF Blocked: Cloud metadata access prohibited.' };
      }

      let addresses: { address: string; family: number }[];
      try {
        addresses = await dns.lookup(hostname, { all: true });
      } catch {
        return { isValid: false, reason: 'DNS resolution failed.' };
      }

      if (!allowLocal) {
        for (const { address } of addresses) {
          if (this.isPrivateOrLocalIp(address)) {
            return {
              isValid: false,
              reason: `SSRF Blocked: Private/internal destination '${hostname}' is not permitted in production.`,
            };
          }
        }
      }

      if (!addresses || addresses.length === 0) {
        return { isValid: false, reason: 'DNS resolution returned no addresses.' };
      }

      return { isValid: true, pinnedIp: addresses[0].address };
    } catch {
      return { isValid: false, reason: 'Malformed URL.' };
    }
  }

  /**
   * Calculates next backoff duration in milliseconds.
   */
  getBackoffDelayMs(attemptNumber: number): number {
    const idx = Math.min(attemptNumber - 1, WebhookDeliveryService.BACKOFF_SCHEDULE_MS.length - 1);
    return WebhookDeliveryService.BACKOFF_SCHEDULE_MS[Math.max(0, idx)];
  }

  /**
   * Dispatches the webhook HTTP request using a pinned IP address
   * to strictly prevent TOCTOU DNS rebinding SSRF attacks.
   */
  private async dispatchWebhook(
    endpointUrl: string,
    pinnedIp: string,
    headers: Record<string, string>,
    body: string,
    timeoutMs: number,
  ): Promise<{ status: number; ok: boolean }> {
    const url = new URL(endpointUrl);
    const isHttps = url.protocol === 'https:';

    const options: http.RequestOptions | https.RequestOptions = {
      method: 'POST',
      hostname: pinnedIp, // Pinned destination IP
      port: url.port ? parseInt(url.port, 10) : isHttps ? 443 : 80,
      path: url.pathname + url.search,
      headers: {
        ...headers,
        Host: url.hostname, // Preserve original hostname for SNI/Host headers
      },
      timeout: timeoutMs,
    };

    if (isHttps) {
      (options as https.RequestOptions).servername = url.hostname; // Crucial for TLS SNI and cert validation
    }

    const reqModule = isHttps ? https : http;

    return new Promise((resolve, reject) => {
      const req = reqModule.request(options, (res) => {
        // Redirection limit (none allowed) must be handled by the caller,
        // but since we only resolve the response, caller handles 3xx as failure.
        resolve({
          status: res.statusCode || 500,
          ok: (res.statusCode || 500) >= 200 && (res.statusCode || 500) < 300,
        });
      });

      req.on('error', (err: Error) => reject(err));

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request Timeout'));
      });

      req.write(body);
      req.end();
    });
  }

  /**
   * Delivers a single webhook delivery attempt.
   */
  async deliver(deliveryId: string): Promise<WebhookDelivery> {
    const queryRunner = this.deliveryRepository.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let delivery: WebhookDelivery | null = null;
    let webhookEvent: WebhookEvent | undefined;
    let webhookConfig: MerchantWebhookConfig | undefined;

    try {
      delivery = await queryRunner.manager.findOne(WebhookDelivery, {
        where: { id: deliveryId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!delivery) {
        throw new Error(`Webhook delivery record ${deliveryId} not found`);
      }

      if (
        delivery.status !== WebhookDeliveryStatus.PENDING &&
        delivery.status !== WebhookDeliveryStatus.FAILED
      ) {
        await queryRunner.rollbackTransaction();
        return delivery;
      }

      const deliveryWithRelations = await queryRunner.manager.findOne(WebhookDelivery, {
        where: { id: deliveryId },
        relations: { webhookEvent: true, webhookConfig: true },
      });

      webhookEvent = deliveryWithRelations?.webhookEvent;
      webhookConfig = deliveryWithRelations?.webhookConfig;

      if (!webhookEvent || !webhookConfig) {
        throw new Error(`Delivery ${deliveryId} is missing associated event or config`);
      }

      delivery.status = WebhookDeliveryStatus.DELIVERING;
      const attemptNumber = delivery.attemptCount + 1;
      delivery.attemptCount = attemptNumber;
      delivery.lastAttemptAt = new Date();

      await queryRunner.manager.save(WebhookDelivery, delivery);
      await queryRunner.commitTransaction();

      if (this.metricsService) {
        this.metricsService.increment('webhooksStarted');
      }

      this.logger.log({
        event: 'webhook.delivery.started',
        webhookDeliveryId: delivery.id,
        webhookEventId: webhookEvent.id,
        merchantId: webhookEvent.merchantId,
        attemptNumber,
      });
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    this.logger.log(`Initiating webhook delivery attempt for delivery ID ${deliveryId}`);

    // SSRF Check
    const ssrfCheck = await this.validateUrlSecurity(webhookConfig.endpointUrl);
    if (!ssrfCheck.isValid || !ssrfCheck.pinnedIp) {
      delivery.status = WebhookDeliveryStatus.EXHAUSTED;
      delivery.lastError = ssrfCheck.reason || 'SSRF blocked';

      const saved = await this.deliveryRepository.save(delivery);

      this.metricsService?.increment('webhooksFailed');
      this.logger.error({
        event: 'webhook.delivery.exhausted',
        webhookDeliveryId: saved.id,
        webhookEventId: webhookEvent.id,
        merchantId: webhookEvent.merchantId,
        error: saved.lastError,
      });

      return saved;
    }

    const rawPayload = JSON.stringify(webhookEvent.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = computeWebhookSignature(webhookConfig.signingSecret, timestamp, rawPayload);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Id': webhookEvent.id,
      'X-Webhook-Timestamp': timestamp,
      'X-Webhook-Signature': signature,
      'User-Agent': 'PaymentGateway-Webhook/1.0',
    };

    try {
      // 5-second request timeout, passing pinned IP
      const response = await this.dispatchWebhook(
        webhookConfig.endpointUrl,
        ssrfCheck.pinnedIp,
        headers,
        rawPayload,
        5000,
      );

      delivery.lastHttpStatus = response.status;

      if (response.status >= 300 && response.status < 400) {
        this.handleRetryableFailure(
          delivery,
          delivery.attemptCount,
          `Merchant returned unexpected redirect HTTP ${response.status}`,
        );
      } else if (response.ok) {
        // HTTP 2xx -> Success
        delivery.status = WebhookDeliveryStatus.DELIVERED;
        delivery.deliveredAt = new Date();
        delivery.lastError = null;
        delivery.nextAttemptAt = null;
      } else if (response.status >= 400 && response.status < 500) {
        // HTTP 4xx -> Permanent merchant client error, do not retry automatically
        delivery.status = WebhookDeliveryStatus.EXHAUSTED;
        delivery.lastError = `Merchant returned non-retryable HTTP ${response.status}`;
        delivery.nextAttemptAt = null;
      } else {
        // HTTP 5xx -> Retryable server error
        this.handleRetryableFailure(
          delivery,
          delivery.attemptCount,
          `Merchant returned HTTP ${response.status}`,
        );
      }
    } catch (err: any) {
      const errorMsg = (err.message || 'Unknown network error').substring(0, 500);
      delivery.lastHttpStatus = null;
      this.handleRetryableFailure(delivery, delivery.attemptCount, errorMsg);
    }

    const saved = await this.deliveryRepository.save(delivery);
    const currentStatus = saved.status as WebhookDeliveryStatus;

    if (currentStatus === WebhookDeliveryStatus.DELIVERED) {
      this.metricsService?.increment('webhooksSucceeded');
      this.logger.log({
        event: 'webhook.delivery.succeeded',
        webhookDeliveryId: saved.id,
        webhookEventId: webhookEvent.id,
        merchantId: webhookEvent.merchantId,
      });
    } else if (currentStatus === WebhookDeliveryStatus.EXHAUSTED) {
      this.metricsService?.increment('webhooksFailed');
      this.logger.error({
        event: 'webhook.delivery.exhausted',
        webhookDeliveryId: saved.id,
        webhookEventId: webhookEvent.id,
        merchantId: webhookEvent.merchantId,
        error: saved.lastError,
      });
    } else if (currentStatus === WebhookDeliveryStatus.FAILED) {
      this.metricsService?.increment('webhookRetries');
      this.logger.warn({
        event: 'webhook.delivery.retry_scheduled',
        webhookDeliveryId: saved.id,
        webhookEventId: webhookEvent.id,
        merchantId: webhookEvent.merchantId,
        error: saved.lastError,
        nextAttemptAt: saved.nextAttemptAt,
      });
    }

    return saved;
  }

  private handleRetryableFailure(
    delivery: WebhookDelivery,
    attemptNumber: number,
    errorMessage: string,
  ) {
    delivery.lastError = errorMessage;

    if (attemptNumber >= WebhookDeliveryService.MAX_ATTEMPTS) {
      delivery.status = WebhookDeliveryStatus.EXHAUSTED;
      delivery.nextAttemptAt = null;
    } else {
      delivery.status = WebhookDeliveryStatus.FAILED;
      const delay = this.getBackoffDelayMs(attemptNumber);
      delivery.nextAttemptAt = new Date(Date.now() + delay);
    }
  }

  /**
   * Lists recent webhook deliveries for a specific merchant, including event and config metadata.
   */
  async listDeliveriesForMerchant(
    merchantId: string,
    limit: number = 50,
  ): Promise<WebhookDelivery[]> {
    return this.deliveryRepository
      .createQueryBuilder('delivery')
      .innerJoinAndSelect('delivery.webhookEvent', 'webhookEvent')
      .leftJoin('delivery.webhookConfig', 'webhookConfig')
      .addSelect(['webhookConfig.id', 'webhookConfig.endpointUrl', 'webhookConfig.status'])
      .where('webhookEvent.merchantId = :merchantId', { merchantId })
      .orderBy('delivery.createdAt', 'DESC')
      .take(limit)
      .getMany();
  }
}
