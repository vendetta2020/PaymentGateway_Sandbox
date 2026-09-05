import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, QueryFailedError, EntityManager } from 'typeorm';
import { Payment } from '../entities/payment.entity';
import { CreatePaymentDto } from '../dto/create-payment.dto';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PaymentProvider } from '../providers/payment-provider.interface';
import { WebhookEventService } from '../../webhook/services/webhook-event.service';
import { WebhookDeliveryService } from '../../webhook/services/webhook-delivery.service';
import { WebhookEventType } from '../../webhook/enums/webhook-event-type.enum';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @Inject('PAYMENT_PROVIDER')
    private readonly paymentProvider: PaymentProvider,
    @Optional()
    private readonly webhookEventService?: WebhookEventService,
    @Optional()
    private readonly webhookDeliveryService?: WebhookDeliveryService,
  ) {}

  async createPayment(
    merchantId: string,
    dto: CreatePaymentDto,
    manager?: EntityManager,
  ): Promise<Payment> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepository;

    if (dto.expiresAt) {
      const expiresDate = new Date(dto.expiresAt);
      if (expiresDate.getTime() <= Date.now()) {
        throw new BadRequestException('expiresAt must be in the future');
      }
    }

    const payment = repo.create({
      merchantId,
      amount: dto.amount,
      currency: dto.currency,
      orderId: dto.orderId,
      description: dto.description,
      paymentMethod: dto.paymentMethod,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      status: PaymentStatus.PENDING,
    });

    try {
      const saved = await repo.save(payment);

      if (this.webhookEventService) {
        const deliveryIds = await this.webhookEventService.recordPaymentEvent(
          merchantId,
          saved,
          WebhookEventType.PAYMENT_CREATED,
          manager,
        );
        this.dispatchDeliveriesAsync(deliveryIds);
      }

      return saved;
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        throw new ConflictException(`Order ID ${dto.orderId} already exists for this merchant`);
      }
      throw error;
    }
  }

  async getPayment(
    merchantId: string,
    paymentId: string,
    manager?: EntityManager,
  ): Promise<Payment> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepository;
    const payment = await repo.findOne({
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
    offset: number = 0,
  ): Promise<[Payment[], number]> {
    return this.paymentRepository.findAndCount({
      where: { merchantId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
  }

  async processPayment(
    merchantId: string,
    paymentId: string,
    manager?: EntityManager,
  ): Promise<Payment> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepository;

    // Step 1: Atomically claim the payment by transitioning PENDING → PROCESSING.
    // This acts as a database-level mutex preventing double provider calls.
    const claimResult = await repo.update(
      { id: paymentId, merchantId, status: PaymentStatus.PENDING },
      { status: PaymentStatus.PROCESSING },
    );

    if (claimResult.affected === 0) {
      // Either the payment doesn't exist, doesn't belong to this merchant,
      // or is not in PENDING status (already processing or terminal).
      const payment = await this.getPayment(merchantId, paymentId, manager);
      throw new BadRequestException(`Cannot process payment in status ${payment.status}`);
    }

    // Step 2: Call the provider. Only one concurrent request can reach here
    // for any given payment because of the atomic claim above.
    try {
      const payment = await this.getPayment(merchantId, paymentId, manager);
      const result = await this.paymentProvider.process(payment);

      // Step 3: Transition PROCESSING → SUCCEEDED or FAILED based on provider result.
      const newStatus =
        result.status === 'SUCCESS' ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;

      await repo.update(
        { id: paymentId, merchantId, status: PaymentStatus.PROCESSING },
        {
          status: newStatus,
          providerReference: result.reference,
        },
      );

      const updatedPayment = await this.getPayment(merchantId, paymentId, manager);

      if (this.webhookEventService) {
        const eventType =
          newStatus === PaymentStatus.SUCCEEDED
            ? WebhookEventType.PAYMENT_SUCCEEDED
            : WebhookEventType.PAYMENT_FAILED;

        const deliveryIds = await this.webhookEventService.recordPaymentEvent(
          merchantId,
          updatedPayment,
          eventType,
          manager,
        );
        this.dispatchDeliveriesAsync(deliveryIds);
      }

      return updatedPayment;
    } catch (error) {
      // Provider system/infrastructure error: revert PROCESSING → PENDING
      // so the payment can be retried later.
      await repo.update(
        { id: paymentId, merchantId, status: PaymentStatus.PROCESSING },
        { status: PaymentStatus.PENDING },
      );
      throw error;
    }
  }

  async transitionStatus(
    merchantId: string,
    paymentId: string,
    newStatus: PaymentStatus,
    manager?: EntityManager,
  ): Promise<Payment> {
    const repo = manager ? manager.getRepository(Payment) : this.paymentRepository;

    if (newStatus === PaymentStatus.PENDING) {
      throw new BadRequestException(`Cannot transition to ${PaymentStatus.PENDING}`);
    }

    const result = await repo.update(
      { id: paymentId, merchantId, status: PaymentStatus.PENDING },
      { status: newStatus },
    );

    if (result.affected === 0) {
      const payment = await this.getPayment(merchantId, paymentId, manager);
      // If we reach here, the payment exists and belongs to the merchant, but status was not PENDING
      throw new BadRequestException(`Cannot transition from terminal state ${payment.status}`);
    }

    const updatedPayment = await this.getPayment(merchantId, paymentId, manager);

    if (this.webhookEventService) {
      let eventType: WebhookEventType | null = null;
      if (newStatus === PaymentStatus.SUCCEEDED) {
        eventType = WebhookEventType.PAYMENT_SUCCEEDED;
      } else if (newStatus === PaymentStatus.FAILED) {
        eventType = WebhookEventType.PAYMENT_FAILED;
      }

      if (eventType) {
        const deliveryIds = await this.webhookEventService.recordPaymentEvent(
          merchantId,
          updatedPayment,
          eventType,
          manager,
        );
        this.dispatchDeliveriesAsync(deliveryIds);
      }
    }

    return updatedPayment;
  }

  private dispatchDeliveriesAsync(deliveryIds: string[]): void {
    if (!deliveryIds || deliveryIds.length === 0 || !this.webhookDeliveryService) return;

    // Dispatched shortly after current turn.
    // At this point, the database transaction has committed.
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
