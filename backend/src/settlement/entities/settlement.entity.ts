import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { SettlementStatus } from '../enums/settlement-status.enum';

@Entity('settlements')
@Index('idx_settlements_merchant', ['merchantId'])
@Index('idx_settlements_status', ['status'])
@Index(
  'idx_settlements_merchant_period_currency',
  ['merchantId', 'periodStart', 'periodEnd', 'currency'],
  { unique: true },
)
export class Settlement {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Column({ type: 'varchar', length: 3 })
  currency!: string;

  @Column({
    name: 'gross_amount',
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  grossAmount!: number;

  @Column({
    name: 'refund_amount',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  refundAmount!: number;

  @Column({
    name: 'net_amount',
    type: 'bigint',
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  netAmount!: number;

  @Column({
    type: 'varchar',
    length: 50,
    default: SettlementStatus.PENDING,
  })
  status!: SettlementStatus;

  @Column({
    name: 'settlement_reference',
    type: 'varchar',
    length: 255,
    unique: true,
  })
  settlementReference!: string;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd!: Date;

  @Column({ name: 'settled_at', type: 'timestamptz', nullable: true })
  settledAt?: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
