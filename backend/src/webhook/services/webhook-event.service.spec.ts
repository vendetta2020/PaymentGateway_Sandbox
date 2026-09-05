import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { WebhookEventService } from './webhook-event.service';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { MerchantWebhookConfig } from '../entities/webhook-config.entity';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { Payment } from '../../payment/entities/payment.entity';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import { PaymentMethodType } from '../../payment/enums/payment-method.enum';

describe('WebhookEventService', () => {
  let service: WebhookEventService;
  let eventRepo: jest.Mocked<Repository<WebhookEvent>>;
  let deliveryRepo: jest.Mocked<Repository<WebhookDelivery>>;
  let configRepo: jest.Mocked<Repository<MerchantWebhookConfig>>;

  beforeEach(async () => {
    eventRepo = {
      create: jest.fn().mockImplementation((e) => e),
      save: jest.fn().mockImplementation(async (e) => e),
    } as any;

    deliveryRepo = {
      create: jest.fn().mockImplementation((d) => d),
      save: jest.fn().mockImplementation(async (d) => ({ ...d, id: 'del-id-123' })),
    } as any;

    configRepo = {
      find: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEventService,
        {
          provide: getRepositoryToken(WebhookEvent),
          useValue: eventRepo,
        },
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: deliveryRepo,
        },
        {
          provide: getRepositoryToken(MerchantWebhookConfig),
          useValue: configRepo,
        },
      ],
    }).compile();

    service = module.get<WebhookEventService>(WebhookEventService);
  });

  const mockPayment: Payment = {
    id: 'pay-uuid-1',
    merchantId: 'merch-uuid-1',
    merchant: {} as any,
    orderId: 'ORD-1234',
    amount: 150000,
    currency: 'IDR',
    paymentMethod: PaymentMethodType.QRIS,
    status: PaymentStatus.SUCCEEDED,
    providerReference: 'PROV-REF-999',
    description: 'Test order payment',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('buildPayload', () => {
    it('should build deterministic payload preserving exact numeric amounts and safe fields', () => {
      const eventId = 'evt-test-1';
      const payload = service.buildPayload(
        eventId,
        WebhookEventType.PAYMENT_SUCCEEDED,
        mockPayment,
      );

      expect(payload.id).toBe(eventId);
      expect(payload.type).toBe(WebhookEventType.PAYMENT_SUCCEEDED);
      expect(payload.created_at).toBeDefined();
      expect(payload.data.payment.id).toBe(mockPayment.id);
      expect(payload.data.payment.amount).toBe(150000);
      expect(payload.data.payment.currency).toBe('IDR');
      expect(payload.data.payment.status).toBe(PaymentStatus.SUCCEEDED);
      expect(payload.data.payment.order_id).toBe('ORD-1234');
      expect(payload.data.payment.provider_reference).toBe('PROV-REF-999');

      // Ensure no sensitive internal auth/secret fields exist
      expect(payload.data.payment.signingSecret).toBeUndefined();
      expect(payload.data.payment.secretHash).toBeUndefined();
    });
  });

  describe('recordPaymentEvent', () => {
    it('should create WebhookEvent and WebhookDelivery for each active merchant config', async () => {
      configRepo.find.mockResolvedValue([
        {
          id: 'cfg-1',
          merchantId: mockPayment.merchantId,
          endpointUrl: 'https://example.com/webhook',
          status: WebhookConfigStatus.ACTIVE,
        } as MerchantWebhookConfig,
      ]);

      const deliveryIds = await service.recordPaymentEvent(
        mockPayment.merchantId,
        mockPayment,
        WebhookEventType.PAYMENT_SUCCEEDED,
      );

      expect(deliveryIds).toHaveLength(1);
      expect(deliveryIds[0]).toBe('del-id-123');

      expect(eventRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          merchantId: mockPayment.merchantId,
          paymentId: mockPayment.id,
          eventType: WebhookEventType.PAYMENT_SUCCEEDED,
          eventKey: `${mockPayment.id}:${WebhookEventType.PAYMENT_SUCCEEDED}`,
        }),
      );

      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookConfigId: 'cfg-1',
          status: WebhookDeliveryStatus.PENDING,
          attemptCount: 0,
        }),
      );
    });

    it('should return empty deliveryIds without error if duplicate eventKey violates unique constraint (23505)', async () => {
      const uniqueError = Object.assign(new QueryFailedError('query', [], new Error()), {
        code: '23505',
      });
      eventRepo.save.mockRejectedValue(uniqueError);

      const deliveryIds = await service.recordPaymentEvent(
        mockPayment.merchantId,
        mockPayment,
        WebhookEventType.PAYMENT_SUCCEEDED,
      );

      expect(deliveryIds).toEqual([]);
      expect(deliveryRepo.create).not.toHaveBeenCalled();
    });
  });
});
