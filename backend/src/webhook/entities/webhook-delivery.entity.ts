import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { WebhookEvent } from './webhook-event.entity';
import { MerchantWebhookConfig } from './webhook-config.entity';
import { WebhookDeliveryStatus } from '../enums/webhook-delivery-status.enum';

@Entity('webhook_deliveries')
@Check(
  'chk_webhook_deliveries_status',
  "status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'EXHAUSTED')",
)
@Index('idx_webhook_deliveries_event', ['webhookEventId'])
@Index('idx_webhook_deliveries_config', ['webhookConfigId'])
@Index('idx_webhook_deliveries_status', ['status'])
export class WebhookDelivery {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'webhook_event_id', type: 'uuid' })
  webhookEventId!: string;

  @ManyToOne(() => WebhookEvent, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_event_id' })
  webhookEvent?: WebhookEvent;

  @Column({ name: 'webhook_config_id', type: 'uuid' })
  webhookConfigId!: string;

  @ManyToOne(() => MerchantWebhookConfig, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'webhook_config_id' })
  webhookConfig?: MerchantWebhookConfig;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookDeliveryStatus.PENDING,
  })
  status!: WebhookDeliveryStatus;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount!: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp', nullable: true })
  nextAttemptAt?: Date | null;

  @Column({ name: 'last_attempt_at', type: 'timestamp', nullable: true })
  lastAttemptAt?: Date | null;

  @Column({ name: 'last_http_status', type: 'int', nullable: true })
  lastHttpStatus?: number | null;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError?: string | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
