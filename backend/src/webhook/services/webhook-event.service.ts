import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager, QueryFailedError } from 'typeorm';
import { WebhookEvent } from '../entities/webhook-event.entity';
import { WebhookDelivery } from '../entities/webhook-delivery.entity';
import { MerchantWebhookConfig } from '../entities/webhook-config.entity';
import { WebhookEventType } from '../enums/webhook-event-type.enum';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';
import { Payment } from '../../payment/entities/payment.entity';
import * as crypto from 'crypto';

@Injectable()
export class WebhookEventService {
  private readonly logger = new Logger(WebhookEventService.name);

  constructor(
    @InjectRepository(WebhookEvent)
    private readonly eventRepository: Repository<WebhookEvent>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepository: Repository<WebhookDelivery>,
    @InjectRepository(MerchantWebhookConfig)
    private readonly configRepository: Repository<MerchantWebhookConfig>,
  ) {}

  /**
   * Builds a standardized, deterministic webhook payload.
   * Does NOT leak any credentials, hashes, or secrets.
   */
  buildPayload(
    eventId: string,
    eventType: WebhookEventType,
    payment: Payment,
  ): Record<string, any> {
    return {
      id: eventId,
      type: eventType,
      created_at: new Date().toISOString(),
      data: {
        payment: {
          id: payment.id,
          merchant_id: payment.merchantId,
          order_id: payment.orderId,
          amount: Number(payment.amount),
          currency: payment.currency,
          payment_method: payment.paymentMethod,
          status: payment.status,
          provider_reference: payment.providerReference || null,
          description: payment.description || null,
          created_at: payment.createdAt,
          updated_at: payment.updatedAt,
        },
      },
    };
  }

  /**
   * Records a webhook event and initializes pending delivery records.
   * Runs within the authoritative payment transaction.
   * Idempotent: duplicate events for the same transition are ignored via UNIQUE(merchant_id, event_key).
   *
   * @returns array of created delivery IDs to dispatch after commit
   */
  async recordPaymentEvent(
    merchantId: string,
    payment: Payment,
    eventType: WebhookEventType,
    manager?: EntityManager,
  ): Promise<string[]> {
    const eventRepo = manager ? manager.getRepository(WebhookEvent) : this.eventRepository;
    const deliveryRepo = manager ? manager.getRepository(WebhookDelivery) : this.deliveryRepository;
    const configRepo = manager
      ? manager.getRepository(MerchantWebhookConfig)
      : this.configRepository;

    const eventKey = `${payment.id}:${eventType}`;
    const eventId = crypto.randomUUID();
    const payload = this.buildPayload(eventId, eventType, payment);

    let savedEvent: WebhookEvent | null = null;

    try {
      const event = eventRepo.create({
        id: eventId,
        merchantId,
        paymentId: payment.id,
        eventType,
        eventKey,
        payload,
      });

      savedEvent = await eventRepo.save(event);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        // Idempotent: Event already created for this transition!
        this.logger.warn(`Duplicate webhook event key ignored: ${eventKey}`);
        return [];
      }
      throw error;
    }

    // Fetch active webhook configurations for this merchant
    const activeConfigs = configRepo
      ? await configRepo.find({
          where: { merchantId, status: WebhookConfigStatus.ACTIVE },
        })
      : [];

    if (activeConfigs.length === 0) {
      return [];
    }

    // Create pending delivery records for each active configuration
    const deliveryIds: string[] = [];
    for (const config of activeConfigs) {
      const delivery = deliveryRepo.create({
        webhookEventId: savedEvent.id,
        webhookConfigId: config.id,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
      });

      const savedDelivery = await deliveryRepo.save(delivery);
      deliveryIds.push(savedDelivery.id);
    }

    return deliveryIds;
  }

  /**
   * Builds a standardized webhook payload for refund events.
   */
  buildRefundPayload(
    eventId: string,
    eventType: WebhookEventType,
    refund: any,
    payment: Payment,
  ): Record<string, any> {
    return {
      id: eventId,
      type: eventType,
      created_at: new Date().toISOString(),
      data: {
        refund: {
          id: refund.id,
          merchant_id: refund.merchantId,
          payment_id: refund.paymentId,
          amount: Number(refund.amount),
          currency: refund.currency,
          reason: refund.reason || null,
          status: refund.status,
          provider_reference: refund.providerReference || null,
          created_at: refund.createdAt,
          updated_at: refund.updatedAt,
          processed_at: refund.processedAt || null,
        },
        payment: {
          id: payment.id,
          order_id: payment.orderId,
          amount: Number(payment.amount),
          currency: payment.currency,
          status: payment.status,
        },
      },
    };
  }

  /**
   * Records a webhook event for refund operations and initializes delivery records.
   * Idempotent: duplicate events for the same transition are ignored via UNIQUE(merchant_id, event_key).
   *
   * @returns array of created delivery IDs to dispatch after commit
   */
  async recordRefundEvent(
    merchantId: string,
    refund: any,
    payment: Payment,
    eventType: WebhookEventType,
    manager?: EntityManager,
  ): Promise<string[]> {
    const eventRepo = manager ? manager.getRepository(WebhookEvent) : this.eventRepository;
    const deliveryRepo = manager ? manager.getRepository(WebhookDelivery) : this.deliveryRepository;
    const configRepo = manager
      ? manager.getRepository(MerchantWebhookConfig)
      : this.configRepository;

    const eventKey = `${refund.id}:${eventType}`;
    const eventId = crypto.randomUUID();
    const payload = this.buildRefundPayload(eventId, eventType, refund, payment);

    let savedEvent: WebhookEvent | null = null;

    try {
      const event = eventRepo.create({
        id: eventId,
        merchantId,
        paymentId: payment.id,
        eventType,
        eventKey,
        payload,
      });

      savedEvent = await eventRepo.save(event);
    } catch (error) {
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        this.logger.warn(`Duplicate webhook event key ignored: ${eventKey}`);
        return [];
      }
      throw error;
    }

    const activeConfigs = configRepo
      ? await configRepo.find({
          where: { merchantId, status: WebhookConfigStatus.ACTIVE },
        })
      : [];

    if (activeConfigs.length === 0) {
      return [];
    }

    const deliveryIds: string[] = [];
    for (const config of activeConfigs) {
      const delivery = deliveryRepo.create({
        webhookEventId: savedEvent.id,
        webhookConfigId: config.id,
        status: WebhookDeliveryStatus.PENDING,
        attemptCount: 0,
      });

      const savedDelivery = await deliveryRepo.save(delivery);
      deliveryIds.push(savedDelivery.id);
    }

    return deliveryIds;
  }
}
