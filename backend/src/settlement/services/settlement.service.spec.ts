import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettlementService } from './settlement.service';
import { Settlement } from '../entities/settlement.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Refund } from '../../refund/entities/refund.entity';
import { SettlementStatus } from '../enums/settlement-status.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('SettlementService', () => {
  let service: SettlementService;
  let settlementRepo: jest.Mocked<Repository<Settlement>>;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let refundRepo: jest.Mocked<Repository<Refund>>;

  const merchantId = 'merchant-settle-uuid';

  beforeEach(async () => {
    settlementRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as any;

    paymentRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    refundRepo = {
      createQueryBuilder: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: getRepositoryToken(Settlement),
          useValue: settlementRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepo,
        },
        {
          provide: getRepositoryToken(Refund),
          useValue: refundRepo,
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  describe('createSettlement', () => {
    function setupMocks(paymentTotal: number = 100000, refundTotal: number = 20000) {
      const paymentQB: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: paymentTotal.toString() }),
      };
      paymentRepo.createQueryBuilder.mockReturnValue(paymentQB);

      const refundQB: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: refundTotal.toString() }),
      };
      refundRepo.createQueryBuilder.mockReturnValue(refundQB);

      settlementRepo.create.mockImplementation((dto: any) => ({
        ...dto,
        id: 'settlement-uuid-1',
      }));
      settlementRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));
    }

    it('should reject invalid dates or periodEnd earlier than periodStart', async () => {
      await expect(
        service.createSettlement(merchantId, {
          periodStart: 'invalid-date',
          periodEnd: '2026-09-06T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createSettlement(merchantId, {
          periodStart: '2026-09-06T10:00:00Z',
          periodEnd: '2026-09-06T08:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should calculate gross amount, refund deduction, and net amount correctly', async () => {
      setupMocks(100000, 30000); // 100k payments, 30k refunds -> 70k net
      settlementRepo.findOne.mockResolvedValue(null);

      const result = await service.createSettlement(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-06T23:59:59Z',
        currency: 'IDR',
      });

      expect(result.grossAmount).toBe(100000);
      expect(result.refundAmount).toBe(30000);
      expect(result.netAmount).toBe(70000);
      expect(result.status).toBe(SettlementStatus.PENDING);
      expect(result.settlementReference).toMatch(/^stl_/);
      expect(result.currency).toBe('IDR');
    });

    it('should return existing settlement if already created for the same period and currency', async () => {
      const existing = {
        id: 'existing-settlement',
        merchantId,
        grossAmount: 50000,
        refundAmount: 0,
        netAmount: 50000,
        status: SettlementStatus.PENDING,
      } as Settlement;

      settlementRepo.findOne.mockResolvedValue(existing);

      const result = await service.createSettlement(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-06T23:59:59Z',
      });

      expect(result.id).toBe('existing-settlement');
      expect(paymentRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('should ensure net amount is non-negative even if refunds exceed payments in the period', async () => {
      setupMocks(20000, 50000); // 20k payments, 50k refunds -> net amount clamped to 0
      settlementRepo.findOne.mockResolvedValue(null);

      const result = await service.createSettlement(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-06T23:59:59Z',
      });

      expect(result.grossAmount).toBe(20000);
      expect(result.refundAmount).toBe(50000);
      expect(result.netAmount).toBe(0);
    });
  });

  describe('transitionStatus', () => {
    it('should transition PENDING -> PROCESSING -> SETTLED and set settledAt', async () => {
      const settlement = {
        id: 'stl-1',
        merchantId,
        status: SettlementStatus.PENDING,
      } as Settlement;

      settlementRepo.findOne.mockResolvedValue(settlement);
      settlementRepo.save.mockImplementation((s: any) => Promise.resolve(s));

      const step1 = await service.transitionStatus(
        merchantId,
        'stl-1',
        SettlementStatus.PROCESSING,
      );
      expect(step1.status).toBe(SettlementStatus.PROCESSING);

      settlement.status = SettlementStatus.PROCESSING;
      const step2 = await service.transitionStatus(merchantId, 'stl-1', SettlementStatus.SETTLED);
      expect(step2.status).toBe(SettlementStatus.SETTLED);
      expect(step2.settledAt).toBeInstanceOf(Date);
    });

    it('should enforce immutability once SETTLED', async () => {
      const settledSettlement = {
        id: 'stl-settled',
        merchantId,
        status: SettlementStatus.SETTLED,
        settledAt: new Date(),
      } as Settlement;

      settlementRepo.findOne.mockResolvedValue(settledSettlement);

      await expect(
        service.transitionStatus(merchantId, 'stl-settled', SettlementStatus.PROCESSING),
      ).rejects.toThrow('Cannot modify settled settlement: financial record is immutable');

      await expect(
        service.transitionStatus(merchantId, 'stl-settled', SettlementStatus.FAILED),
      ).rejects.toThrow('Cannot modify settled settlement: financial record is immutable');
    });

    it('should reject invalid transition from FAILED', async () => {
      const failedSettlement = {
        id: 'stl-failed',
        merchantId,
        status: SettlementStatus.FAILED,
      } as Settlement;

      settlementRepo.findOne.mockResolvedValue(failedSettlement);

      await expect(
        service.transitionStatus(merchantId, 'stl-failed', SettlementStatus.SETTLED),
      ).rejects.toThrow('Cannot transition from terminal status FAILED');
    });
  });

  describe('getSettlement', () => {
    it('should throw NotFoundException if settlement does not belong to merchant', async () => {
      settlementRepo.findOne.mockResolvedValue(null);

      await expect(service.getSettlement(merchantId, 'other-stl')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
