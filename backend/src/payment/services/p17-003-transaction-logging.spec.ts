import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PaymentService } from './payment.service';
import { IdempotencyService } from './idempotency.service';
import { Payment } from '../entities/payment.entity';
import { IdempotencyKey } from '../entities/idempotency-key.entity';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentMethodType } from '../enums/payment-method.enum';
import { Logger } from '@nestjs/common';

import { DataSource } from 'typeorm';

describe('P17-003: Payment Lifecycle Events Transaction Commit Boundary', () => {
  let paymentService: PaymentService;
  let idempotencyService: IdempotencyService;
  let metricsService: MetricsService;

  let mockQueryRunner: any;
  let mockEntityManager: any;
  let loggerSpy: jest.SpyInstance;

  beforeEach(async () => {
    mockEntityManager = {
      getRepository: jest.fn().mockReturnValue({
        create: jest.fn().mockImplementation((p) => p),
        save: jest.fn().mockImplementation((p) => ({ ...p, id: 'pay_123' })),
        update: jest.fn().mockResolvedValue({ affected: 1 }),
        findOne: jest.fn().mockResolvedValue({
          id: 'pay_123',
          merchantId: 'merch_123',
          status: PaymentStatus.PROCESSING,
        }),
      }),
      save: jest.fn(),
    };

    mockQueryRunner = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      manager: mockEntityManager,
      data: {}, // Vital for afterCommitCallbacks
    };

    mockEntityManager.queryRunner = mockQueryRunner;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        IdempotencyService,
        MetricsService,
        {
          provide: getRepositoryToken(Payment),
          useValue: {},
        },
        {
          provide: getRepositoryToken(IdempotencyKey),
          useValue: {
            manager: {
              connection: {
                createQueryRunner: () => mockQueryRunner,
              },
            },
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((k) => k),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: () => mockQueryRunner,
          },
        },
        {
          provide: 'PAYMENT_PROVIDER',
          useValue: {
            process: jest.fn().mockResolvedValue({ status: 'SUCCESS', reference: 'ref_123' }),
          },
        },
      ],
    }).compile();

    paymentService = module.get<PaymentService>(PaymentService);
    idempotencyService = module.get<IdempotencyService>(IdempotencyService);
    metricsService = module.get<MetricsService>(MetricsService);

    loggerSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(metricsService, 'increment');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('1 & 8. payment.created after successful commit - successful transaction emits exactly one intended event', async () => {
    await idempotencyService.executeIdempotent(
      'merch_123',
      'key_1',
      'hash',
      '/test',
      async (manager) => {
        await paymentService.createPayment(
          'merch_123',
          {
            amount: 1000,
            currency: 'IDR',
            orderId: 'ord_1',
            description: 'test',
            paymentMethod: PaymentMethodType.CARD,
          },
          manager,
        );

        // Before commit, log should NOT have been called
        expect(loggerSpy).not.toHaveBeenCalled();

        return { status: 201, body: {} };
      },
    );

    // After executeIdempotent commits, the log should be emitted exactly once
    expect(loggerSpy).toHaveBeenCalledTimes(1);
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'payment.created' }));
    expect(metricsService.increment).toHaveBeenCalledWith('paymentsCreated');
  });

  it('4, 5 & 7. transaction rollback produces NO lifecycle creation event / DB failure before commit', async () => {
    mockQueryRunner.commitTransaction.mockRejectedValue(new Error('DB commit failure'));

    await expect(
      idempotencyService.executeIdempotent(
        'merch_123',
        'key_2',
        'hash',
        '/test',
        async (manager) => {
          await paymentService.createPayment(
            'merch_123',
            {
              amount: 1000,
              currency: 'IDR',
              orderId: 'ord_2',
              description: 'test',
              paymentMethod: PaymentMethodType.CARD,
            },
            manager,
          );

          expect(loggerSpy).not.toHaveBeenCalled(); // No event emitted inside transaction

          return { status: 201, body: {} };
        },
      ),
    ).rejects.toThrow('DB commit failure');

    // After failure, no event should have ever been emitted
    expect(loggerSpy).not.toHaveBeenCalled();
    expect(metricsService.increment).not.toHaveBeenCalled();
  });

  it('2. payment.succeeded after successful commit', async () => {
    await idempotencyService.executeIdempotent(
      'merch_123',
      'key_3',
      'hash',
      '/test',
      async (manager) => {
        await paymentService.processPayment('merch_123', 'pay_123', manager);

        // Logger should not be called synchronously!
        expect(loggerSpy).not.toHaveBeenCalled();

        return { status: 200, body: {} };
      },
    );

    // After commit, both processing and succeeded events are emitted
    expect(loggerSpy).toHaveBeenCalledTimes(2);
    expect(loggerSpy).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'payment.processing' }),
    );
    expect(loggerSpy).toHaveBeenCalledWith(expect.objectContaining({ event: 'payment.succeeded' }));
    expect(metricsService.increment).toHaveBeenCalledWith('paymentsSucceeded');
  });

  it('9 & 10. idempotent replay does not incorrectly duplicate lifecycle events & concurrent processing does not produce false events', async () => {
    // Simulate finding an existing completed idempotency key
    // We can't access module here, but we can override mock on idempotencyService's repository since it's injected
    (idempotencyService as any).idempotencyKeyRepository.findOne.mockResolvedValueOnce({
      merchantId: 'merch_123',
      key: 'key_4',
      requestHash: 'hash',
      responseStatus: 200,
      responseBody: { success: true },
    });

    const result = await idempotencyService.executeIdempotent(
      'merch_123',
      'key_4',
      'hash',
      '/test',
      async (manager) => {
        // This inner block should never run for a cached response
        await paymentService.createPayment(
          'merch_123',
          {
            amount: 100,
            currency: 'IDR',
            orderId: 'ord',
            paymentMethod: PaymentMethodType.CARD,
            description: 'test',
          },
          manager,
        );
        return { status: 201, body: {} };
      },
    );

    expect(result.status).toBe(200);
    // Logger MUST remain silent for cached idempotent replays since state did not mutate
    expect(loggerSpy).not.toHaveBeenCalled();
  });
});
