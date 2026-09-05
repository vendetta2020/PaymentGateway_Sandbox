import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentStatus } from '../enums/payment-status.enum';

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  async createPayment(merchantId: string, dto: CreatePaymentDto): Promise<Payment> {
    const payment = this.paymentRepository.create({
      merchantId,
      amount: dto.amount,
      currency: dto.currency,
      orderId: dto.orderId,
      description: dto.description,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      status: PaymentStatus.PENDING,
    });

    try {
      return await this.paymentRepository.save(payment);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`Order ID ${dto.orderId} already exists for this merchant`);
      }
      throw error;
    }
  }

  async getPayment(merchantId: string, paymentId: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, merchantId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found`);
    }

    return payment;
  }

  async listPayments(merchantId: string): Promise<Payment[]> {
    return this.paymentRepository.find({
      where: { merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  async transitionStatus(merchantId: string, paymentId: string, newStatus: PaymentStatus): Promise<Payment> {
    const payment = await this.getPayment(merchantId, paymentId);

    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot transition from terminal state ${payment.status}`);
    }

    if (newStatus === PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot transition to ${PaymentStatus.PENDING}`);
    }

    payment.status = newStatus;
    return this.paymentRepository.save(payment);
  }
}
