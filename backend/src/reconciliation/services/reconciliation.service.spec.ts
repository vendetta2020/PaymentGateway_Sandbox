import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationRun } from '../entities/reconciliation-run.entity';
import { ReconciliationResult } from '../entities/reconciliation-result.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import { ReconciliationDiscrepancyType } from '../enums/reconciliation-discrepancy-type.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('ReconciliationService', () => {
  let service: ReconciliationService;
  let runRepo: jest.Mocked<Repository<ReconciliationRun>>;
  let resultRepo: jest.Mocked<Repository<ReconciliationResult>>;
  let paymentRepo: jest.Mocked<Repository<Payment>>;
  let paymentProvider: { getTransactions: jest.Mock };

  const merchantId = 'merchant-recon-uuid';

  beforeEach(async () => {
    runRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      findAndCount: jest.fn(),
    } as any;

    resultRepo = {
      create: jest.fn((dto: any) => ({ ...dto, id: 'result-uuid-1' })),
      save: jest.fn((items: any) => Promise.resolve(items)),
    } as any;

    paymentRepo = {
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    paymentProvider = {
      getTransactions: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationService,
        {
          provide: getRepositoryToken(ReconciliationRun),
          useValue: runRepo,
        },
        {
          provide: getRepositoryToken(ReconciliationResult),
          useValue: resultRepo,
        },
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepo,
        },
        {
          provide: 'PAYMENT_PROVIDER',
          useValue: paymentProvider,
        },
      ],
    }).compile();

    service = module.get<ReconciliationService>(ReconciliationService);
  });

  describe('runReconciliation', () => {
    it('should reject invalid dates or periodEnd earlier than periodStart', async () => {
      await expect(
        service.runReconciliation(merchantId, {
          periodStart: 'invalid-date',
          periodEnd: '2026-09-06T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.runReconciliation(merchantId, {
          periodStart: '2026-09-06T10:00:00Z',
          periodEnd: '2026-09-06T08:00:00Z',
        }),
      ).rejects.toThrow('periodEnd must be strictly greater than periodStart');

      await expect(
        service.runReconciliation(merchantId, {
          periodStart: '2026-09-06T10:00:00Z',
          periodEnd: '2026-09-06T10:00:00Z',
        }),
      ).rejects.toThrow('periodEnd must be strictly greater than periodStart');
    });

    it('should reject periods longer than 31 days to prevent algorithmic denial of service', async () => {
      // Exactly 31 days should pass validation (but fail downstream if we don't mock, so we just mock the rest)
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockReturnValue({} as any);
      runRepo.save.mockResolvedValue({} as any);
      paymentRepo.find.mockResolvedValue([]);
      paymentProvider.getTransactions.mockResolvedValue([]);

      await expect(
        service.runReconciliation(merchantId, {
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-02-01T00:00:00Z', // 31 days
        }),
      ).resolves.toBeDefined();

      // 31 days and 1 second should fail
      await expect(
        service.runReconciliation(merchantId, {
          periodStart: '2026-01-01T00:00:00Z',
          periodEnd: '2026-02-01T00:00:01Z', // 31 days + 1 second
        }),
      ).rejects.toThrow('Reconciliation period cannot exceed 31 days');
    });

    it('should produce MATCHED results when internal and provider records match perfectly', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({
        ...dto,
        id: 'run-uuid-1',
      }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      const internalPayments = [
        {
          id: 'pay-1',
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_1',
          createdAt: new Date('2026-09-01T10:00:00Z'),
        } as Payment,
      ];
      paymentRepo.find.mockResolvedValue(internalPayments);

      const providerRecords = [
        {
          providerReference: 'ref_1',
          amount: 100000,
          currency: 'IDR',
          providerStatus: 'SUCCESS' as const,
          transactionTime: new Date('2026-09-01T10:00:00Z'),
        },
      ];
      paymentProvider.getTransactions.mockResolvedValue(providerRecords);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
      });

      expect(run.status).toBe(ReconciliationStatus.COMPLETED);
      expect(run.matchedCount).toBe(1);
      expect(run.discrepancyCount).toBe(0);
      expect(run.totalInternalAmount).toBe(100000);
      expect(run.totalProviderAmount).toBe(100000);

      // Verify non-mutation of internal payments
      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });

    it('should classify MISSING_IN_PROVIDER when internal payment has no provider record', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([
        {
          id: 'pay-missing-in-prov',
          amount: 50000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_ghost_prov',
          createdAt: new Date(),
        } as Payment,
      ]);

      paymentProvider.getTransactions.mockResolvedValue([]); // Empty provider records

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'MISSING_IN_PROVIDER',
      });

      expect(run.discrepancyCount).toBe(1);
      expect(run.matchedCount).toBe(0);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.MISSING_IN_PROVIDER,
          internalAmount: 50000,
        }),
      );
    });

    it('should classify MISSING_IN_INTERNAL when provider has an unrecorded transaction', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([]); // No internal payments

      paymentProvider.getTransactions.mockResolvedValue([
        {
          providerReference: 'ref_extra_prov',
          amount: 75000,
          currency: 'IDR',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(),
        },
      ]);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'MISSING_IN_INTERNAL',
      });

      expect(run.discrepancyCount).toBe(1);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.MISSING_IN_INTERNAL,
          providerAmount: 75000,
        }),
      );
    });

    it('should classify AMOUNT_MISMATCH when amounts differ and NEVER mutate internal payment', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([
        {
          id: 'pay-amt',
          amount: 100000, // Internal is 100k
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_amt',
          createdAt: new Date(),
        } as Payment,
      ]);

      paymentProvider.getTransactions.mockResolvedValue([
        {
          providerReference: 'ref_amt',
          amount: 90000, // Provider is 90k
          currency: 'IDR',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(),
        },
      ]);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'AMOUNT_MISMATCH',
      });

      expect(run.discrepancyCount).toBe(1);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.AMOUNT_MISMATCH,
          internalAmount: 100000,
          providerAmount: 90000,
        }),
      );

      // Crucial: Payment truth was NOT altered
      expect(paymentRepo.save).not.toHaveBeenCalled();
      expect(paymentRepo.update).not.toHaveBeenCalled();
    });

    it('should classify CURRENCY_MISMATCH when currencies differ', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([
        {
          id: 'pay-curr',
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_curr',
          createdAt: new Date(),
        } as Payment,
      ]);

      paymentProvider.getTransactions.mockResolvedValue([
        {
          providerReference: 'ref_curr',
          amount: 100000,
          currency: 'USD',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(),
        },
      ]);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'CURRENCY_MISMATCH',
      });

      expect(run.discrepancyCount).toBe(1);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.CURRENCY_MISMATCH,
          internalCurrency: 'IDR',
          providerCurrency: 'USD',
        }),
      );
    });

    it('should classify STATUS_MISMATCH when provider reports non-SUCCESS status', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([
        {
          id: 'pay-stat',
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_stat',
          createdAt: new Date(),
        } as Payment,
      ]);

      paymentProvider.getTransactions.mockResolvedValue([
        {
          providerReference: 'ref_stat',
          amount: 100000,
          currency: 'IDR',
          providerStatus: 'FAILED',
          transactionTime: new Date(),
        },
      ]);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'STATUS_MISMATCH',
      });

      expect(run.discrepancyCount).toBe(1);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.STATUS_MISMATCH,
          internalStatus: PaymentStatus.SUCCEEDED,
          providerStatus: 'FAILED',
        }),
      );
    });

    it('should classify DUPLICATE_PROVIDER_REFERENCE when provider has duplicate references', async () => {
      runRepo.findOne.mockResolvedValue(null);
      runRepo.create.mockImplementation((dto: any) => ({ ...dto, id: 'run-uuid-1' }));
      runRepo.save.mockImplementation((entity: any) => Promise.resolve({ ...entity }));

      paymentRepo.find.mockResolvedValue([
        {
          id: 'pay-dup',
          amount: 100000,
          currency: 'IDR',
          status: PaymentStatus.SUCCEEDED,
          providerReference: 'ref_dup',
          createdAt: new Date(),
        } as Payment,
      ]);

      paymentProvider.getTransactions.mockResolvedValue([
        {
          providerReference: 'ref_dup',
          amount: 100000,
          currency: 'IDR',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(),
        },
        {
          providerReference: 'ref_dup', // Duplicate entry in provider side!
          amount: 100000,
          currency: 'IDR',
          providerStatus: 'SUCCESS',
          transactionTime: new Date(),
        },
      ]);

      const run = await service.runReconciliation(merchantId, {
        periodStart: '2026-09-01T00:00:00Z',
        periodEnd: '2026-09-02T00:00:00Z',
        scenario: 'DUPLICATE_PROVIDER_REFERENCE',
      });

      expect(run.discrepancyCount).toBeGreaterThanOrEqual(1);
      expect(resultRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          discrepancyType: ReconciliationDiscrepancyType.DUPLICATE_PROVIDER_REFERENCE,
          providerReference: 'ref_dup',
        }),
      );
    });

    it('should mark run as FAILED and rethrow when provider simulator experiences technical failure', async () => {
      runRepo.findOne.mockResolvedValue(null);
      const newRun = {
        id: 'run-fail-tech',
        merchantId,
        status: ReconciliationStatus.RUNNING,
      } as ReconciliationRun;
      runRepo.create.mockReturnValue(newRun);
      runRepo.save.mockImplementation((entity: any) => Promise.resolve(entity));

      paymentRepo.find.mockResolvedValue([]);
      paymentProvider.getTransactions.mockRejectedValue(new Error('Provider connection timeout'));

      await expect(
        service.runReconciliation(merchantId, {
          periodStart: '2026-09-01T00:00:00Z',
          periodEnd: '2026-09-02T00:00:00Z',
          scenario: 'SIMULATE_SYSTEM_ERROR',
        }),
      ).rejects.toThrow('Provider connection timeout');

      expect(newRun.status).toBe(ReconciliationStatus.FAILED);
      expect(runRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ReconciliationStatus.FAILED }),
      );
    });
  });

  describe('getReconciliation', () => {
    it('should throw NotFoundException if run does not belong to merchant', async () => {
      runRepo.findOne.mockResolvedValue(null);

      await expect(service.getReconciliation(merchantId, 'other-run')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
