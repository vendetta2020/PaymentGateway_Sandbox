import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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
    if (dto.expiresAt) {
      const expiresDate = new Date(dto.expiresAt);
      if (expiresDate.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future');
      }
    }

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

  async listPayments(
    merchantId: string, 
    limit: number = 10, 
    offset: number = 0
  ): Promise<[Payment[], number]> {
    return this.paymentRepository.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async transitionStatus(merchantId: string, paymentId: string, newStatus: PaymentStatus): Promise<Payment> {
    if (newStatus === PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot transition to ${PaymentStatus.PENDING}`);
    }

    const result = await this.paymentRepository.update(
      { id: paymentId, merchantId, status: PaymentStatus.PENDING },
      { status: newStatus }
    );

    if (result.affected === 0) {
      const payment = await this.getPayment(merchantId, paymentId);
      // If we reach here, the payment exists and belongs to the merchant, but status was not PENDING
      throw new BadRequestException(`Cannot transition from terminal state ${payment.status}`);
    }

    return this.getPayment(merchantId, paymentId);
  }
}
