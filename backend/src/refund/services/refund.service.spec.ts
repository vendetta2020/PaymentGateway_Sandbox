import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { RefundService } from './refund.service';
import { Refund } from '../entities/refund.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { RefundStatus } from '../enums/refund-status.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import { WebhookEventService } from '../../webhook/services/webhook-event.service';
import { WebhookDeliveryService } from '../../webhook/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhook/enums/webhook-event-type.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('RefundService', () => {
  let service: RefundService;
  let refundRepo: jest.Mocked<Repository<Refund>>;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let paymentProvider: { process: jest.Mock; refund: jest.Mock };
  let webhookEventService: { recordRefundEvent: jest.Mock };
  let webhookDeliveryService: { deliver: jest.Mock };
  let mockManager: Partial<EntityManager>;

  const merchantId = 'merchant-uuid-1';
  const paymentId = 'payment-uuid-1';

  beforeEach(async () => {
    refundRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      createQueryBuilder: jest.fn(),
    } as any;

    paymentRepo = {
      findOne: jest.fn(),
    } as any;

    paymentProvider = {
      process: jest.fn(),
      refund: jest.fn(),
    };

    webhookEventService = {
      recordRefundEvent: jest.fn().mockResolvedValue(['delivery-1']),
    };

    webhookDeliveryService = {
      deliver: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefundService,
        {
          provide: getRepositoryToken(Refund),
          useValue: refundRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepo,
        },
        {
          provide: 'PAYMENT_PROVIDER',
          useValue: paymentProvider,
        },
        {
          provide: WebhookEventService,
          useValue: webhookEventService,
        },
        {
          provide: WebhookDeliveryService,
          useValue: webhookDeliveryService,
        },
      ],
    }).compile();

    service = module.get<RefundService>(RefundService);
  });

  describe('createRefund', () => {
    function setupMockManager(payment: Partial<Payment> | null, sumAmount: number = 0) {
      const paymentQueryBuilder: any = {
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(payment),
      };

      const refundQueryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalRefunded: sumAmount.toString() }),
      };

      const managerRefundRepo: any = {
        create: jest.fn((dto) => ({ ...dto, id: 'refund-uuid-1' })),
        save: jest.fn((entity) => Promise.resolve({ ...entity })),
      };

      mockManager = {
        createQueryBuilder: jest.fn((entity) => {
          if (entity === Payment || (typeof entity === 'function' && entity.name === 'Payment')) {
            return paymentQueryBuilder;
          }
          return refundQueryBuilder;
        }) as any,
        getRepository: jest.fn((entity) => {
          if (entity === Refund || (typeof entity === 'function' && entity.name === 'Refund')) {
            return managerRefundRepo;
          }
          return refundRepo;
        }) as any,
      };
    }

    it('should throw BadRequestException if amount is non-positive or not integer', async () => {
      setupMockManager({
        id: paymentId,
        merchantId,
        amount: 100000,
        currency: 'IDR',
        status: PaymentStatus.SUCCEEDED,
      });

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 0 },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: -500 },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50.5 } as any,
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if payment does not exist or does not belong to merchant', async () => {
      setupMockManager(null);

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50000 },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject refund if payment status is PENDING', async () => {
      setupMockManager({
        id: paymentId,
        merchantId,
        amount: 100000,
        currency: 'IDR',
        status: PaymentStatus.PENDING,
      });

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50000 },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject refund if payment status is FAILED', async () => {
      setupMockManager({
        id: paymentId,
        merchantId,
        amount: 100000,
        currency: 'IDR',
        status: PaymentStatus.FAILED,
      });

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50000 },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject refund if currency does not match payment currency', async () => {
      setupMockManager({
        id: paymentId,
        merchantId,
        amount: 100000,
        currency: 'IDR',
        status: PaymentStatus.SUCCEEDED,
      });

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50000, currency: 'USD' },
          undefined,
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully process a full refund', async () => {
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        0, // 0 already refunded
      );

      paymentProvider.refund.mockResolvedValue({
        status: 'SUCCESS',
        reference: 'ref_sim_succ_123',
      });

      const { refund, deliveryIds } = await service.createRefund(
        merchantId,
        paymentId,
        { amount: 100000, reason: 'Full refund' },
        'key-1',
        mockManager as EntityManager,
      );

      expect(refund.status).toBe(RefundStatus.SUCCESS);
      expect(refund.amount).toBe(100000);
      expect(refund.providerReference).toBe('ref_sim_succ_123');
      expect(refund.processedAt).toBeInstanceOf(Date);
      expect(deliveryIds).toHaveLength(2); // refund.created + refund.succeeded
      expect(webhookEventService.recordRefundEvent).toHaveBeenCalledWith(
        merchantId,
        expect.any(Object),
        expect.any(Object),
        WebhookEventType.REFUND_CREATED,
        mockManager,
      );
      expect(webhookEventService.recordRefundEvent).toHaveBeenCalledWith(
        merchantId,
        expect.any(Object),
        expect.any(Object),
        WebhookEventType.REFUND_SUCCEEDED,
        mockManager,
      );
    });

    it('should successfully process multiple partial refunds', async () => {
      // First partial refund of 30,000
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        0,
      );

      paymentProvider.refund.mockResolvedValue({
        status: 'SUCCESS',
        reference: 'ref_sim_succ_part1',
      });

      const refund1 = await service.createRefund(
        merchantId,
        paymentId,
        { amount: 30000 },
        'key-part-1',
        mockManager as EntityManager,
      );
      expect(refund1.refund.status).toBe(RefundStatus.SUCCESS);
      expect(refund1.refund.amount).toBe(30000);

      // Second partial refund of 20,000 (after 30,000 already refunded)
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        30000,
      );

      paymentProvider.refund.mockResolvedValue({
        status: 'SUCCESS',
        reference: 'ref_sim_succ_part2',
      });

      const refund2 = await service.createRefund(
        merchantId,
        paymentId,
        { amount: 20000 },
        'key-part-2',
        mockManager as EntityManager,
      );
      expect(refund2.refund.status).toBe(RefundStatus.SUCCESS);
      expect(refund2.refund.amount).toBe(20000);
    });

    it('should reject over-refund when requested amount exceeds remaining balance', async () => {
      // Payment: 100,000, already refunded: 50,000, requested: 60,000 (exceeds remaining 50,000)
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        50000,
      );

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 60000 },
          'key-over',
          mockManager as EntityManager,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should set status to FAILED and emit refund.failed when provider returns FAILED', async () => {
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        0,
      );

      paymentProvider.refund.mockResolvedValue({
        status: 'FAILED',
        reference: 'ref_sim_fail_456',
      });

      const { refund } = await service.createRefund(
        merchantId,
        paymentId,
        { amount: 50000, reason: 'SIMULATE_FAILURE' },
        'key-fail',
        mockManager as EntityManager,
      );

      expect(refund.status).toBe(RefundStatus.FAILED);
      expect(refund.providerReference).toBe('ref_sim_fail_456');
      expect(webhookEventService.recordRefundEvent).toHaveBeenCalledWith(
        merchantId,
        expect.any(Object),
        expect.any(Object),
        WebhookEventType.REFUND_FAILED,
        mockManager,
      );
    });

    it('should rethrow and not mark FAILED if provider encounters unexpected system exception', async () => {
      setupMockManager(
        {
          id: paymentId,
          merchantId,
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
        },
        0,
      );

      paymentProvider.refund.mockRejectedValue(new Error('Network timeout'));

      await expect(
        service.createRefund(
          merchantId,
          paymentId,
          { amount: 50000, reason: 'SIMULATE_SYSTEM_ERROR' },
          'key-err',
          mockManager as EntityManager,
        ),
      ).rejects.toThrow('Network timeout');
    });
  });

  describe('getRefund', () => {
    it('should return refund if found and belongs to merchant', async () => {
      const mockRefund = {
        id: 'refund-1',
        merchantId,
        paymentId,
        amount: 50000,
        status: RefundStatus.SUCCESS,
      };

      refundRepo.findOne.mockResolvedValue(mockRefund as Refund);

      const result = await service.getRefund(merchantId, 'refund-1');
      expect(result).toEqual(mockRefund);
    });

    it('should throw NotFoundException if refund does not belong to merchant', async () => {
      refundRepo.findOne.mockResolvedValue(null);

      await expect(service.getRefund(merchantId, 'other-refund')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listRefundsForPayment', () => {
    it('should return list of refunds if payment belongs to merchant', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: paymentId, merchantId } as Payment);
      refundRepo.find.mockResolvedValue([
        { id: 'ref-1', amount: 30000 } as Refund,
        { id: 'ref-2', amount: 20000 } as Refund,
      ]);

      const result = await service.listRefundsForPayment(merchantId, paymentId);
      expect(result).toHaveLength(2);
    });

    it('should throw NotFoundException if payment does not belong to merchant', async () => {
      paymentRepo.findOne.mockResolvedValue(null);

      await expect(service.listRefundsForPayment(merchantId, paymentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
