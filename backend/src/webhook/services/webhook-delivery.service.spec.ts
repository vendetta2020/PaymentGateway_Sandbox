import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dns from 'dns/promises';

jest.mock('dns/promises', () => ({
  lookup: jest.fn(),
}));
import * as https from 'https';

jest.mock('https', () => ({
  request: jest.fn(),
}));
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
  let queryRunnerMock: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    queryRunnerMock = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: {
        findOne: jest.fn(),
        save: jest.fn().mockImplementation(async (e: any) => e),
      },
    };

    deliveryRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (e) => e),
      createQueryBuilder: jest.fn(),
      manager: {
        connection: {
          createQueryRunner: jest.fn().mockReturnValue(queryRunnerMock),
        },
      },
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
    let dnsSpy: jest.Mock;

    beforeEach(() => {
      dnsSpy = (dns.lookup as jest.Mock).mockImplementation(async (hostname: any) => {
        // Return dummy address for the test hostnames
        if (hostname === 'merchant-api.example.com')
          return [{ address: '93.184.216.34', family: 4 }] as any;
        if (hostname === 'server.example.com')
          return [{ address: '93.184.216.34', family: 4 }] as any;
        if (hostname === 'localhost') return [{ address: '127.0.0.1', family: 4 }] as any;

        // For actual IPs passed in the hostname, just return them
        return [{ address: hostname, family: 4 }] as any;
      });
    });

    afterEach(() => {
      dnsSpy.mockReset();
    });

    it('should allow valid public HTTPS URL', async () => {
      const result = await service.validateUrlSecurity('https://merchant-api.example.com/webhooks');
      expect(result.isValid).toBe(true);
    });

    it('should reject non-HTTP protocols (file://, ftp://)', async () => {
      expect((await service.validateUrlSecurity('file:///etc/passwd')).isValid).toBe(false);
      expect((await service.validateUrlSecurity('ftp://server.example.com')).isValid).toBe(false);
    });

    it('should block localhost and private IP when ALLOW_DEV_LOCAL_WEBHOOKS is false', async () => {
      configService.get.mockReturnValue(false);

      expect((await service.validateUrlSecurity('http://localhost:8080')).isValid).toBe(false);
      expect((await service.validateUrlSecurity('http://127.0.0.1:3000')).isValid).toBe(false);
      expect((await service.validateUrlSecurity('http://10.0.0.1/webhook')).isValid).toBe(false);
      expect((await service.validateUrlSecurity('http://192.168.1.1/webhook')).isValid).toBe(false);
      expect((await service.validateUrlSecurity('http://172.20.0.1/webhook')).isValid).toBe(false);
    });

    it('should block cloud metadata IP unconditionally', async () => {
      configService.get.mockReturnValue(true); // even if dev local is true

      expect(
        (await service.validateUrlSecurity('http://169.254.169.254/latest/meta-data')).isValid,
      ).toBe(false);
      expect((await service.validateUrlSecurity('http://metadata.google.internal')).isValid).toBe(
        false,
      );
    });

    it('should allow localhost when ALLOW_DEV_LOCAL_WEBHOOKS is true in dev/test', async () => {
      configService.get.mockReturnValue(true);

      expect((await service.validateUrlSecurity('http://localhost:8080/webhook')).isValid).toBe(
        true,
      );
      expect((await service.validateUrlSecurity('http://127.0.0.1:9090/webhook')).isValid).toBe(
        true,
      );
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
      (dns.lookup as jest.Mock).mockImplementation(async (_hostname: any) => {
        return [{ address: '127.0.0.1', family: 4 }] as any;
      });
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
      queryRunnerMock.manager.findOne.mockResolvedValue(mockDelivery);

      const dispatchSpy = jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({
        ok: true,
        status: 200,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(result.lastHttpStatus).toBe(200);
      expect(result.attemptCount).toBe(1);
      expect(result.deliveredAt).toBeInstanceOf(Date);
      expect(result.lastError).toBeNull();

      dispatchSpy.mockRestore();
    });

    it('should mark delivery as EXHAUSTED on non-retryable HTTP 400 response', async () => {
      const mockDelivery = createMockDelivery();
      queryRunnerMock.manager.findOne.mockResolvedValue(mockDelivery);

      const dispatchSpy = jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({
        ok: false,
        status: 400,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(result.lastHttpStatus).toBe(400);
      expect(result.nextAttemptAt).toBeNull();
      expect(result.lastError).toContain('non-retryable HTTP 400');

      dispatchSpy.mockRestore();
    });

    it('should mark delivery as FAILED with scheduled nextAttemptAt on HTTP 500', async () => {
      const mockDelivery = createMockDelivery(0);
      queryRunnerMock.manager.findOne.mockResolvedValue(mockDelivery);

      const dispatchSpy = jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({
        ok: false,
        status: 500,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(result.lastHttpStatus).toBe(500);
      expect(result.attemptCount).toBe(1);
      expect(result.nextAttemptAt).toBeInstanceOf(Date);

      dispatchSpy.mockRestore();
    });

    it('should mark delivery as EXHAUSTED when attemptCount reaches MAX_ATTEMPTS', async () => {
      const mockDelivery = createMockDelivery(4); // 4th attempt previously, this will be 5th
      queryRunnerMock.manager.findOne.mockResolvedValue(mockDelivery);

      const dispatchSpy = jest.spyOn(service as any, 'dispatchWebhook').mockResolvedValue({
        ok: false,
        status: 503,
      });

      const result = await service.deliver('del-1');

      expect(result.status).toBe(WebhookDeliveryStatus.EXHAUSTED);
      expect(result.attemptCount).toBe(5);
      expect(result.nextAttemptAt).toBeNull();

      dispatchSpy.mockRestore();
    });

    it('should prevent TOCTOU DNS rebinding by pinning the validated IP', async () => {
      const mockDelivery = createMockDelivery();
      mockDelivery.webhookConfig!.endpointUrl = 'https://rebinding.example.com/webhook';
      queryRunnerMock.manager.findOne.mockResolvedValue(mockDelivery);
      configService.get.mockReturnValue(false); // Enable strict SSRF checks

      // First lookup returns safe public IP, second returns private IP
      const lookupSpy = (dns.lookup as jest.Mock).mockImplementation(async () => {
        if (lookupSpy.mock.calls.length === 1) {
          return [{ address: '93.184.216.34', family: 4 }] as any;
        }
        return [{ address: '10.0.0.1', family: 4 }] as any; // Rebind to private!
      });

      const httpRequestSpy = (https.request as jest.Mock).mockImplementation(
        (_options, cb: any) => {
          // Mock successful response
          if (cb) cb({ statusCode: 200, headers: {} } as any);
          return {
            on: jest.fn(),
            write: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
          } as any;
        },
      );

      await service.deliver('del-1');

      expect(lookupSpy).toHaveBeenCalledTimes(1); // Should only lookup ONCE!

      // Verify the pinned IP was used for the connection
      expect(httpRequestSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          hostname: '93.184.216.34',
          servername: 'rebinding.example.com',
          headers: expect.objectContaining({
            Host: 'rebinding.example.com',
          }),
        }),
        expect.any(Function),
      );

      lookupSpy.mockRestore();
      httpRequestSpy.mockReset();
    });
  });

  describe('listDeliveriesForMerchant', () => {
    it('should query deliveries for merchant with event and config joins', async () => {
      const qbMock = {
        innerJoinAndSelect: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValueOnce([{ id: 'delivery-1' }]),
      };
      deliveryRepo.createQueryBuilder = jest.fn().mockReturnValue(qbMock);

      const result = await service.listDeliveriesForMerchant('m-1', 20);

      expect(deliveryRepo.createQueryBuilder).toHaveBeenCalledWith('delivery');
      expect(qbMock.innerJoinAndSelect).toHaveBeenCalledWith(
        'delivery.webhookEvent',
        'webhookEvent',
      );
      expect(qbMock.leftJoin).toHaveBeenCalledWith('delivery.webhookConfig', 'webhookConfig');
      expect(qbMock.where).toHaveBeenCalledWith('webhookEvent.merchantId = :merchantId', {
        merchantId: 'm-1',
      });
      expect(qbMock.take).toHaveBeenCalledWith(20);
      expect(result).toEqual([{ id: 'delivery-1' }]);
    });
  });
});
