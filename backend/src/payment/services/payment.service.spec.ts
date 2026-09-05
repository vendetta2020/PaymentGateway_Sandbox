import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentMethodType } from '../enums/payment-method.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;

  let paymentProvider: jest.Mocked<any>;

  beforeEach(async () => {
    paymentRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    } as any;

    paymentProvider = {
      process: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepository,
        },
        {
          provide: 'PAYMENT_PROVIDER',
          useValue: paymentProvider,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('createPayment', () => {
    it('should successfully create a payment', async () => {
      const dto: CreatePaymentDto = {
        amount: 1000,
        currency: 'USD',
        orderId: 'ORDER123',
        paymentMethod: PaymentMethodType.QRIS,
      };

      const payment = { ...dto, id: '1', merchantId: 'merchant-1', status: PaymentStatus.PENDING };

      paymentRepository.create.mockReturnValue(payment as Payment);
      paymentRepository.save.mockResolvedValue(payment as Payment);

      const result = await service.createPayment('merchant-1', dto);

      expect(paymentRepository.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        amount: 1000,
        currency: 'USD',
        orderId: 'ORDER123',
        description: undefined,
        paymentMethod: PaymentMethodType.QRIS,
        expiresAt: undefined,
        status: PaymentStatus.PENDING,
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(payment);
      expect(result).toEqual(payment);
    });

    it('should throw ConflictException on duplicate orderId', async () => {
      const dto: CreatePaymentDto = {
        amount: 100,
        currency: 'USD',
        orderId: 'DUP',
        paymentMethod: PaymentMethodType.QRIS,
      };
      paymentRepository.create.mockReturnValue({} as Payment);
      paymentRepository.save.mockRejectedValue(
        Object.assign(new QueryFailedError('query', [], new Error()), { code: '23505' }),
      );

      await expect(service.createPayment('merchant-1', dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('getPayment', () => {
    it('should return a payment if found and belongs to merchant', async () => {
      const payment = { id: 'pay-1', merchantId: 'merchant-1' };
      paymentRepository.findOne.mockResolvedValue(payment as Payment);

      const result = await service.getPayment('merchant-1', 'pay-1');
      expect(result).toEqual(payment);
    });

    it('should throw NotFoundException if payment does not exist', async () => {
      paymentRepository.findOne.mockResolvedValue(null);
      await expect(service.getPayment('merchant-1', 'pay-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('listPayments', () => {
    it('should return list of payments and count for the merchant', async () => {
      const payments = [{ id: '1' }, { id: '2' }];
      paymentRepository.findAndCount.mockResolvedValue([payments as Payment[], 2]);

      const [result, count] = await service.listPayments('merchant-1', 10, 0);
      expect(paymentRepository.findAndCount).toHaveBeenCalledWith({
        where: { merchantId: 'merchant-1' },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result).toEqual(payments);
      expect(count).toBe(2);
    });
  });

  describe('processPayment', () => {
    it('should atomically claim PENDING→PROCESSING, call provider, and transition to SUCCEEDED', async () => {
      // Step 1: claim succeeds
      paymentRepository.update
        .mockResolvedValueOnce({ affected: 1 } as any)   // PENDING → PROCESSING
        .mockResolvedValueOnce({ affected: 1 } as any);  // PROCESSING → SUCCEEDED

      const processingPayment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING } as Payment;
      const succeededPayment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED, providerReference: 'sim_succ_abc' } as Payment;

      paymentRepository.findOne
        .mockResolvedValueOnce(processingPayment)   // getPayment for provider
        .mockResolvedValueOnce(succeededPayment);   // getPayment for return

      paymentProvider.process.mockResolvedValue({ status: 'SUCCESS', reference: 'sim_succ_abc' });

      const result = await service.processPayment('merchant-1', 'pay-1');

      // Verify atomic claim: PENDING → PROCESSING
      expect(paymentRepository.update).toHaveBeenNthCalledWith(1,
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PENDING },
        { status: PaymentStatus.PROCESSING },
      );
      // Verify provider was called
      expect(paymentProvider.process).toHaveBeenCalledWith(processingPayment);
      // Verify final transition: PROCESSING → SUCCEEDED
      expect(paymentRepository.update).toHaveBeenNthCalledWith(2,
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING },
        { status: PaymentStatus.SUCCEEDED, providerReference: 'sim_succ_abc' },
      );
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('should transition to FAILED when provider returns FAILED', async () => {
      paymentRepository.update
        .mockResolvedValueOnce({ affected: 1 } as any)   // PENDING → PROCESSING
        .mockResolvedValueOnce({ affected: 1 } as any);  // PROCESSING → FAILED

      const processingPayment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING } as Payment;
      const failedPayment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.FAILED, providerReference: 'sim_fail_xyz' } as Payment;

      paymentRepository.findOne
        .mockResolvedValueOnce(processingPayment)
        .mockResolvedValueOnce(failedPayment);

      paymentProvider.process.mockResolvedValue({ status: 'FAILED', reference: 'sim_fail_xyz' });

      const result = await service.processPayment('merchant-1', 'pay-1');

      expect(paymentRepository.update).toHaveBeenNthCalledWith(2,
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING },
        { status: PaymentStatus.FAILED, providerReference: 'sim_fail_xyz' },
      );
      expect(result.status).toBe(PaymentStatus.FAILED);
    });

    it('should revert PROCESSING→PENDING on provider system error and rethrow', async () => {
      paymentRepository.update
        .mockResolvedValueOnce({ affected: 1 } as any)   // PENDING → PROCESSING
        .mockResolvedValueOnce({ affected: 1 } as any);  // PROCESSING → PENDING (revert)

      const processingPayment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING } as Payment;
      paymentRepository.findOne.mockResolvedValueOnce(processingPayment);

      const systemError = new Error('Provider connection timeout');
      paymentProvider.process.mockRejectedValue(systemError);

      await expect(service.processPayment('merchant-1', 'pay-1')).rejects.toThrow('Provider connection timeout');

      // Verify revert: PROCESSING → PENDING
      expect(paymentRepository.update).toHaveBeenNthCalledWith(2,
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PROCESSING },
        { status: PaymentStatus.PENDING },
      );
    });

    it('should throw BadRequestException when claim fails (race condition / non-PENDING)', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 0 } as any);

      const payment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED } as Payment;
      paymentRepository.findOne.mockResolvedValue(payment);

      await expect(service.processPayment('merchant-1', 'pay-1')).rejects.toThrow(BadRequestException);

      // Verify provider was NEVER called
      expect(paymentProvider.process).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when payment does not exist', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 0 } as any);
      paymentRepository.findOne.mockResolvedValue(null);

      await expect(service.processPayment('merchant-1', 'nonexistent')).rejects.toThrow(NotFoundException);
      expect(paymentProvider.process).not.toHaveBeenCalled();
    });
  });

  describe('transitionStatus', () => {
    it('should transition status from PENDING to SUCCEEDED', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 1 } as any);
      const payment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED };
      paymentRepository.findOne.mockResolvedValue(payment as Payment);

      const result = await service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.SUCCEEDED);
      expect(paymentRepository.update).toHaveBeenCalledWith(
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PENDING },
        { status: PaymentStatus.SUCCEEDED },
      );
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('should throw BadRequestException if current status is terminal', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 0 } as any);
      const payment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED };
      paymentRepository.findOne.mockResolvedValue(payment as Payment);

      await expect(
        service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.FAILED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new status is PENDING', async () => {
      await expect(
        service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.PENDING),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
