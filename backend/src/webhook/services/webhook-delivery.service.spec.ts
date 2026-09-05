import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  WebhookDeliveryService,
  computeWebhookSignature,
  verifyWebhookSignature,
} from './webhook-delivery.service';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let deliveryRepo: jest.Mocked<Repository<WebhookDelivery>>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    deliveryRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e) => e),
    } as any;

    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'ALLOW_DEV_LOCAL_WEBHOOKS') return false;
        return undefined;
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: deliveryRepo,
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<WebhookDeliveryService>(WebhookDeliveryService);
  });

  describe('Cryptographic Signature & Verification', () => {
    const secret = 'whsec_test_secret_1234567890abcdef1234567890abcdef';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const payload = JSON.stringify({ event: 'payment.succeeded', id: 'pay_123' });

    it('should compute deterministic HMAC-SHA256 signature', () => {
      const sig1 = computeWebhookSignature(secret, timestamp, payload);
      const sig2 = computeWebhookSignature(secret, timestamp, payload);

      expect(sig1).toBe(sig2);
      expect(sig1).toHaveLength(64); // SHA-256 hex string length
    });

    it('should verify signature successfully when timestamp and payload match', () => {
      const signature = computeWebhookSignature(secret, timestamp, payload);
      const isValid = verifyWebhookSignature(secret, timestamp, payload, signature);

      expect(isValid).toBe(true);
    });

    it('should reject tampered payload', () => {
      const signature = computeWebhookSignature(secret, timestamp, payload);
      const tamperedPayload = JSON.stringify({ event: 'payment.succeeded', id: 'pay_tampered' });
      const isValid = verifyWebhookSignature(secret, timestamp, tamperedPayload, signature);

      expect(isValid).toBe(false);
    });

    it('should reject stale timestamp (> tolerance)', () => {
      const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400s ago
      const signature = computeWebhookSignature(secret, staleTimestamp, payload);
      const isValid = verifyWebhookSignature(secret, staleTimestamp, payload, signature, 300);

      expect(isValid).toBe(false);
    });
  });

  describe('SSRF Protection', () => {
    it('should allow valid public HTTPS URL', () => {
      const result = service.validateUrlSecurity('https://merchant-api.example.com/webhooks');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-HTTP protocols (file://, ftp://)', () => {
      expect(service.validateUrlSecurity('file:///etc/passwd').isValid).toBe(false);
      expect(service.validateUrlSecurity('ftp://server.example.com').isValid).toBe(false);
    });

    it('should block localhost and private IP when ALLOW_DEV_LOCAL_WEBHOOKS is false', () => {
      configService.get.mockReturnValue(false);

      expect(service.validateUrlSecurity('http://localhost:8080').isValid).toBe(false);
      expect(service.validateUrlSecurity('http://127.0.0.1:3000').isValid).toBe(false);
      expect(service.validateUrlSecurity('http://10.0.0.1/webhook').isValid).toBe(false);
      expect(service.validateUrlSecurity('http://192.168.1.1/webhook').isValid).toBe(false);
      expect(service.validateUrlSecurity('http://172.20.0.1/webhook').isValid).toBe(false);
    });

    it('should block cloud metadata IP unconditionally', () => {
      configService.get.mockReturnValue(true); // even if dev local is true

      expect(service.validateUrlSecurity('http://169.254.169.254/latest/meta-data').isValid).toBe(
        false,
      );
      expect(service.validateUrlSecurity('http://metadata.google.internal').isValid).toBe(false);
    });

    it('should allow localhost when ALLOW_DEV_LOCAL_WEBHOOKS is true in dev/test', () => {
      configService.get.mockReturnValue(true);

      expect(service.validateUrlSecurity('http://localhost:8080/webhook').isValid).toBe(true);
      expect(service.validateUrlSecurity('http://127.0.0.1:9090/webhook').isValid).toBe(true);
    });
  });

  describe('Retry Backoff Schedule', () => {
    it('should calculate deterministic backoff delays', () => {
      expect(service.getBackoffDelayMs(1)).toBe(60 * 1000); // 1 min
      expect(service.getBackoffDelayMs(2)).toBe(5 * 60 * 1000); // 5 mins
      expect(service.getBackoffDelayMs(3)).toBe(15 * 60 * 1000); // 15 mins
      expect(service.getBackoffDelayMs(4)).toBe(30 * 60 * 1000); // 30 mins
      expect(service.getBackoffDelayMs(5)).toBe(60 * 60 * 1000); // 60 mins
      expect(service.getBackoffDelayMs(10)).toBe(60 * 60 * 1000); // capped at max
    });
  });

  describe('deliver', () => {
    beforeEach(() => {
      // allow localhost for mock delivery tests
      configService.get.mockReturnValue(true);
    });

    const createMockDelivery = (attemptCount = 0) =>
      ({
        id: 'del-1',
        attemptCount,
        status: WebhookDeliveryStatus.PENDING,
        webhookEvent: {
          id: 'evt-1',
          payload: { event: 'payment.succeeded' },
        },
        webhookConfig: {
          id: 'cfg-1',
          endpointUrl: 'https://example.com/webhook',
          signingSecret: 'whsec_test',
          status: WebhookConfigStatus.ACTIVE,
        },
      }) as unknown as WebhookDelivery;

    it('should mark delivery as DELIVERED on HTTP 200 response', async () => {
      const mockDelivery = createMockDelivery();
      deliveryRepo.findOne.mockResolvedValue(mockDelivery);

      // Mock global fetch
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = mockFetch;

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(result.lastHttpStatus).toBe(200);
      expect(result.attemptCount).toBe(1);
      expect(result.deliveredAt).toBeInstanceOf(Date);
      expect(result.lastError).toBeNull();
    });

    it('should mark delivery as EXHAUSTED on non-retryable HTTP 400 response', async () => {
      const mockDelivery = createMockDelivery();
      deliveryRepo.findOne.mockResolvedValue(mockDelivery);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(result.lastHttpStatus).toBe(400);
      expect(result.nextAttemptAt).toBeNull();
      expect(result.lastError).toContain('non-retryable HTTP 400');
    });

    it('should mark delivery as FAILED with scheduled nextAttemptAt on HTTP 500', async () => {
      const mockDelivery = createMockDelivery(0);
      deliveryRepo.findOne.mockResolvedValue(mockDelivery);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(result.lastHttpStatus).toBe(500);
      expect(result.attemptCount).toBe(1);
      expect(result.nextAttemptAt).toBeInstanceOf(Date);
    });

    it('should mark delivery as EXHAUSTED when attemptCount reaches MAX_ATTEMPTS', async () => {
      const mockDelivery = createMockDelivery(4); // 4th attempt previously, this will be 5th
      deliveryRepo.findOne.mockResolvedValue(mockDelivery);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(result.attemptCount).toBe(5);
      expect(result.nextAttemptAt).toBeNull();
    });
  });
});
