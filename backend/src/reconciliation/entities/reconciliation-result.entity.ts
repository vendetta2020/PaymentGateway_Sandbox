import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ReconciliationRun } from './reconciliation-run.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { ReconciliationDiscrepancyType } from '../enums/reconciliation-discrepancy-type.enum';

@Entity('reconciliation_results')
@Index('idx_reconciliation_results_run', ['reconciliationRunId'])
@Index('idx_reconciliation_results_type', ['discrepancyType'])
export class ReconciliationResult {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'reconciliation_run_id', type: 'uuid' })
  reconciliationRunId!: string;

  @ManyToOne(() => ReconciliationRun, (run) => run.results, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reconciliation_run_id' })
  reconciliationRun!: ReconciliationRun;

  @Column({ name: 'provider_reference', type: 'varchar', length: 255, nullable: true })
  providerReference?: string | null;

  @Column({ name: 'payment_id', type: 'uuid', nullable: true })
  paymentId?: string | null;

  @ManyToOne(() => Payment, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'payment_id' })
  payment?: Payment | null;

  @Column({
    name: 'discrepancy_type',
    type: 'varchar',
    length: 50,
  })
  discrepancyType!: ReconciliationDiscrepancyType;

  @Column({
    name: 'internal_amount',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value ? parseInt(value, 10) : null),
    },
  })
  internalAmount?: number | null;

  @Column({
    name: 'provider_amount',
    type: 'bigint',
    nullable: true,
    transformer: {
      to: (value: number | null) => value,
      from: (value: string | null) => (value ? parseInt(value, 10) : null),
    },
  })
  providerAmount?: number | null;

  @Column({ name: 'internal_currency', type: 'varchar', length: 3, nullable: true })
  internalCurrency?: string | null;

  @Column({ name: 'provider_currency', type: 'varchar', length: 3, nullable: true })
  providerCurrency?: string | null;

  @Column({ name: 'internal_status', type: 'varchar', length: 50, nullable: true })
  internalStatus?: string | null;

  @Column({ name: 'provider_status', type: 'varchar', length: 50, nullable: true })
  providerStatus?: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  details?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
