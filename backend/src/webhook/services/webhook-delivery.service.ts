import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import * as crypto from 'crypto';

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
  ) {}

  /**
   * SSRF Protection: Validates protocol and rejects private/internal IPs
   * unless ALLOW_DEV_LOCAL_WEBHOOKS is explicitly enabled in dev/test.
   */
  validateUrlSecurity(urlString: string): { isValid: boolean; reason?: string } {
    try {
      const parsed = new URL(urlString);

      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { isValid: false, reason: 'Unsupported protocol. Only http/https allowed.' };
      }

      const allowLocal = Boolean(this.configService.get<boolean>('ALLOW_DEV_LOCAL_WEBHOOKS'));
      const hostname = parsed.hostname.toLowerCase();

      // Check if hostname is an internal/localhost destination
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '::1' ||
        hostname.endsWith('.localhost');

      const isPrivateIp =
        hostname.startsWith('10.') ||
        hostname.startsWith('192.168.') ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

      const isCloudMetadata =
        hostname === '169.254.169.254' ||
        hostname === 'metadata.google.internal' ||
        hostname.endsWith('.internal');

      if (!allowLocal && (isLocalhost || isPrivateIp || isCloudMetadata)) {
        return {
          isValid: false,
          reason: `SSRF Blocked: Private/internal destination '${hostname}' is not permitted in production.`,
        };
      }

      if (isCloudMetadata) {
        return { isValid: false, reason: 'SSRF Blocked: Cloud metadata access prohibited.' };
      }

      return { isValid: true };
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
   * Delivers a single webhook delivery attempt.
   */
  async deliver(deliveryId: string): Promise<WebhookDelivery> {
    let delivery = await this.deliveryRepository.findOne({
      where: { id: deliveryId },
      relations: { webhookEvent: true, webhookConfig: true },
    });

    // If delivery was just created in an active transaction, wait briefly for commit
    let attempts = 0;
    while (!delivery && attempts < 20) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId },
        relations: { webhookEvent: true, webhookConfig: true },
      });
      attempts++;
    }

    if (!delivery) {
      throw new Error(`Webhook delivery record ${deliveryId} not found`);
    }

    if (delivery.status === WebhookDeliveryStatus.DELIVERED) {
      return delivery;
    }

    const { webhookEvent, webhookConfig } = delivery;

    if (!webhookEvent || !webhookConfig) {
      throw new Error(`Delivery ${deliveryId} is missing associated event or config`);
    }

    this.logger.log(`Initiating webhook delivery attempt for delivery ID ${deliveryId}`);

    // SSRF Check
    const ssrfCheck = this.validateUrlSecurity(webhookConfig.endpointUrl);
    if (!ssrfCheck.isValid) {
      delivery.status = WebhookDeliveryStatus.EXHAUSTED;
      delivery.lastError = ssrfCheck.reason;
      delivery.lastAttemptAt = new Date();
      delivery.attemptCount += 1;
      return this.deliveryRepository.save(delivery);
    }

    delivery.status = WebhookDeliveryStatus.DELIVERING;
    await this.deliveryRepository.save(delivery);

    // Prepare Signed Request
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

    const attemptNumber = delivery.attemptCount + 1;
    delivery.attemptCount = attemptNumber;
    delivery.lastAttemptAt = new Date();

    try {
      // 5-second request timeout via AbortSignal
      const response = await fetch(webhookConfig.endpointUrl, {
        method: 'POST',
        headers,
        body: rawPayload,
        signal: AbortSignal.timeout(5000),
      });

      delivery.lastHttpStatus = response.status;

      if (response.ok) {
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
          attemptNumber,
          `Merchant returned HTTP ${response.status}`,
        );
      }
    } catch (err: any) {
      const errorMsg = (err.message || 'Unknown network error').substring(0, 500);
      delivery.lastHttpStatus = null;
      this.handleRetryableFailure(delivery, attemptNumber, errorMsg);
    }

    return this.deliveryRepository.save(delivery);
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
}
