import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { PaymentService } from './payment.service';
import { Payment } from '../entities/payment.entity';
import { PaymentStatus } from '../enums/payment-status.enum';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PaymentService', () => {
  let service: PaymentService;
  let paymentRepository: jest.Mocked<Repository<Payment>>;

  beforeEach(async () => {
    const paymentRepoMock = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      findAndCount: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: getRepositoryToken(Payment),
          useValue: paymentRepoMock,
        },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    paymentRepository = module.get(getRepositoryToken(Payment));
  });

  describe('createPayment', () => {
    it('should create and save a payment with PENDING status', async () => {
      const dto: CreatePaymentDto = {
        amount: 10000,
        currency: 'IDR',
        orderId: 'ORDER-123',
      };
      const createdPayment = { id: 'payment-1', ...dto, status: PaymentStatus.PENDING };

      paymentRepository.create.mockReturnValue(createdPayment as Payment);
      paymentRepository.save.mockResolvedValue(createdPayment as Payment);

      const result = await service.createPayment('merchant-1', dto);

      expect(paymentRepository.create).toHaveBeenCalledWith({
        merchantId: 'merchant-1',
        amount: dto.amount,
        currency: dto.currency,
        orderId: dto.orderId,
        description: undefined,
        expiresAt: undefined,
        status: PaymentStatus.PENDING,
      });
      expect(paymentRepository.save).toHaveBeenCalledWith(createdPayment);
      expect(result).toEqual(createdPayment);
    });

    it('should throw ConflictException on duplicate order_id', async () => {
      const dto: CreatePaymentDto = { amount: 100, currency: 'USD', orderId: 'DUP' };
      const createdPayment = { ...dto, status: PaymentStatus.PENDING };
      paymentRepository.create.mockReturnValue(createdPayment as Payment);

      const error = new QueryFailedError('query', [], new Error());
      (error as any).code = '23505';
      paymentRepository.save.mockRejectedValue(error);

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

  describe('transitionStatus', () => {
    it('should transition status from PENDING to SUCCEEDED', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 1 } as any);
      const payment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED };
      paymentRepository.findOne.mockResolvedValue(payment as Payment);

      const result = await service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.SUCCEEDED);
      expect(paymentRepository.update).toHaveBeenCalledWith(
        { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.PENDING },
        { status: PaymentStatus.SUCCEEDED }
      );
      expect(result.status).toBe(PaymentStatus.SUCCEEDED);
    });

    it('should throw BadRequestException if current status is terminal', async () => {
      paymentRepository.update.mockResolvedValue({ affected: 0 } as any);
      const payment = { id: 'pay-1', merchantId: 'merchant-1', status: PaymentStatus.SUCCEEDED };
      paymentRepository.findOne.mockResolvedValue(payment as Payment);

      await expect(service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.FAILED)).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if new status is PENDING', async () => {
      await expect(service.transitionStatus('merchant-1', 'pay-1', PaymentStatus.PENDING)).rejects.toThrow(BadRequestException);
    });
  });
});
