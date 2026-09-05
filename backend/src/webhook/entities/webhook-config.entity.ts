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
import { Merchant } from '../../merchant/entities/merchant.entity';
import { WebhookConfigStatus } from '../enums/webhook-config-status.enum';

@Entity('merchant_webhook_configs')
@Check('chk_webhook_configs_status', "status IN ('ACTIVE', 'DISABLED')")
@Index('idx_webhook_configs_merchant_status', ['merchantId', 'status'])
export class MerchantWebhookConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant?: Merchant;

  @Column({ name: 'endpoint_url', type: 'varchar', length: 500 })
  endpointUrl!: string;

  @Column({ name: 'signing_secret', type: 'varchar', length: 255 })
  signingSecret!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: WebhookConfigStatus.ACTIVE,
  })
  status!: WebhookConfigStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
