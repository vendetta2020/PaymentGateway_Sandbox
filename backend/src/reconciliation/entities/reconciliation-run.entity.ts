import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Merchant } from '../../merchant/entities/merchant.entity';
import { ReconciliationStatus } from '../enums/reconciliation-status.enum';
import { ReconciliationResult } from './reconciliation-result.entity';

@Entity('reconciliation_runs')
@Index('idx_reconciliation_runs_merchant', ['merchantId'])
@Index('idx_reconciliation_runs_status', ['status'])
@Index('idx_reconciliation_runs_merchant_period', ['merchantId', 'periodStart', 'periodEnd'], {
  unique: true,
})
export class ReconciliationRun {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @ManyToOne(() => Merchant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Column({ name: 'period_start', type: 'timestamptz' })
  periodStart!: Date;

  @Column({ name: 'period_end', type: 'timestamptz' })
  periodEnd!: Date;

  @Column({
    type: 'varchar',
    length: 50,
    default: ReconciliationStatus.PENDING,
  })
  status!: ReconciliationStatus;

  @Column({
    name: 'total_internal_amount',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  totalInternalAmount!: number;

  @Column({
    name: 'total_provider_amount',
    type: 'bigint',
    default: 0,
    transformer: {
      to: (value: number) => value,
      from: (value: string) => parseInt(value, 10),
    },
  })
  totalProviderAmount!: number;

  @Column({ name: 'matched_count', type: 'integer', default: 0 })
  matchedCount!: number;

  @Column({ name: 'discrepancy_count', type: 'integer', default: 0 })
  discrepancyCount!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt?: Date;

  @OneToMany(() => ReconciliationResult, (result) => result.reconciliationRun)
  results?: ReconciliationResult[];
}
