import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('webhook_events')
@Index('idx_webhook_events_merchant_event_key', ['merchantId', 'eventKey'], { unique: true })
@Index('idx_webhook_events_payment', ['paymentId'])
export class WebhookEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ name: 'payment_id', type: 'uuid' })
  paymentId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ name: 'event_key', type: 'varchar', length: 255 })
  eventKey!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
