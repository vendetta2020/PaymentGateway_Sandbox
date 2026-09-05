import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Refund } from '../entities/refund.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { CreateRefundDto } from '../dto/create-refund.dto';
import { RefundStatus } from '../enums/refund-status.enum';
import { PaymentStatus } from '../../payment/enums/payment-status.enum';
import { PaymentProvider } from '../../payment/providers/payment-provider.interface';
import { WebhookEventService } from '../../webhook/services/webhook-event.service';
import { WebhookDeliveryService } from '../../webhook/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhook/enums/webhook-event-type.enum';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(
    @InjectRepository(Refund)
    private readonly refundRepository: Repository<Refund>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject('PAYMENT_PROVIDER')
    private readonly paymentProvider: PaymentProvider,
    @Optional()
    private readonly webhookEventService?: WebhookEventService,
    @Optional()
    private readonly webhookDeliveryService?: WebhookDeliveryService,
  ) {}

  /**
   * Creates and processes a refund within a transactional boundary.
   * Uses PostgreSQL pessimistic row locking on the parent payment row
   * to strictly serialize concurrent refund attempts and prevent over-refunding.
   */
  async createRefund(
    merchantId: string,
    paymentId: string,
    dto: CreateRefundDto,
    idempotencyKey?: string,
    manager?: EntityManager,
  ): Promise<{ refund: Refund; deliveryIds: string[] }> {
    if (!manager) {
      throw new Error('Transaction manager is required for atomic refund processing');
    }

    if (!dto.amount || !Number.isInteger(dto.amount) || dto.amount <= 0) {
      throw new BadRequestException('Refund amount must be a positive integer');
    }

    // 1. Lock the parent payment row to prevent race conditions on refundable balance
    const payment = await manager
      .createQueryBuilder(Payment, 'payment')
      .setLock('pessimistic_write')
      .where('payment.id = :paymentId', { paymentId })
      .andWhere('payment.merchantId = :merchantId', { merchantId })
      .getOne();

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // 2. Validate payment eligibility
    if (payment.status !== PaymentStatus.SUCCEEDED) {
      throw new BadRequestException(
        `Payment is not eligible for refund (status: ${payment.status})`,
      );
    }

    // 3. Validate currency if provided
    if (dto.currency && dto.currency.toUpperCase() !== payment.currency.toUpperCase()) {
      throw new BadRequestException(
        `Currency mismatch: expected ${payment.currency}, got ${dto.currency}`,
      );
    }

    // 4. Calculate existing active refunds (PENDING reserves balance, SUCCESS is committed)
    const sumResult = await manager
      .createQueryBuilder(Refund, 'refund')
      .select('COALESCE(SUM(refund.amount), 0)', 'totalRefunded')
      .where('refund.payment_id = :paymentId', { paymentId })
      .andWhere('refund.status IN (:...statuses)', {
        statuses: [RefundStatus.PENDING, RefundStatus.SUCCESS],
      })
      .getRawOne();

    const alreadyRefunded = parseInt(sumResult.totalRefunded, 10);
    const paymentAmount = Number(payment.amount);
    const remainingRefundable = paymentAmount - alreadyRefunded;

    if (dto.amount > remainingRefundable) {
      throw new BadRequestException(
        `Refund amount (${dto.amount}) exceeds remaining refundable balance (${remainingRefundable})`,
      );
    }

    // 5. Create refund record in PENDING status (reserving the refundable amount)
    const refundRepo = manager.getRepository(Refund);
    const refund = refundRepo.create({
      merchantId,
      paymentId,
      amount: dto.amount,
      currency: payment.currency,
      reason: dto.reason,
      idempotencyKey,
      status: RefundStatus.PENDING,
    });

    const savedRefund = await refundRepo.save(refund);

    const deliveryIds: string[] = [];

    // 6. Record refund.created webhook event
    if (this.webhookEventService) {
      const createdIds = await this.webhookEventService.recordRefundEvent(
        merchantId,
        savedRefund,
        payment,
        WebhookEventType.REFUND_CREATED,
        manager,
      );
      deliveryIds.push(...createdIds);
    }

    // 7. Invoke provider simulator
    const providerResult = await this.paymentProvider.refund(savedRefund, payment);

    // 8. Update refund with terminal status based on provider response
    const finalStatus =
      providerResult.status === 'SUCCESS' ? RefundStatus.SUCCESS : RefundStatus.FAILED;

    savedRefund.status = finalStatus;
    savedRefund.providerReference = providerResult.reference;
    savedRefund.processedAt = new Date();

    const finalizedRefund = await refundRepo.save(savedRefund);

    // 9. Record terminal webhook event (refund.succeeded or refund.failed)
    if (this.webhookEventService) {
      const terminalEventType =
        finalStatus === RefundStatus.SUCCESS
          ? WebhookEventType.REFUND_SUCCEEDED
          : WebhookEventType.REFUND_FAILED;

      const terminalIds = await this.webhookEventService.recordRefundEvent(
        merchantId,
        finalizedRefund,
        payment,
        terminalEventType,
        manager,
      );
      deliveryIds.push(...terminalIds);
    }

    return {
      refund: finalizedRefund,
      deliveryIds,
    };
  }

  async getRefund(merchantId: string, refundId: string): Promise<Refund> {
    const refund = await this.refundRepository.findOne({
      where: { id: refundId, merchantId },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }

  async listRefundsForPayment(merchantId: string, paymentId: string): Promise<Refund[]> {
    // Enforce merchant ownership of the payment first
    const payment = await this.paymentRepository.findOne({
      where: { id: paymentId, merchantId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.refundRepository.find({
      where: { paymentId, merchantId },
      order: { createdAt: 'DESC' },
    });
  }

  dispatchDeliveriesAsync(deliveryIds: string[]): void {
    if (!deliveryIds || deliveryIds.length === 0 || !this.webhookDeliveryService) return;

    // Dispatched shortly after transaction commit
    setTimeout(async () => {
      for (const id of deliveryIds) {
        try {
          await this.webhookDeliveryService!.deliver(id);
        } catch (error: any) {
          this.logger.error(`Asynchronous webhook delivery error for ${id}: ${error.message}`);
        }
      }
    }, 50);
  }
}
