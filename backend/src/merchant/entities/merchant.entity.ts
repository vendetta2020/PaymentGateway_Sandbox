import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MerchantStatus } from '../enums/merchant-status.enum';

/**
 * Merchant entity representing businesses utilizing the payment gateway.
 *
 * Design considerations:
 * - ID is UUIDv4 for distributed uniqueness and security against enumeration.
 * - Email is strictly UNIQUE at the database level and stored normalized (lowercase, trimmed).
 * - BusinessName represents the official trading entity.
 * - No monetary/payment balance fields exist here — those belong to future payment domains.
 */
@Entity('merchants')
export class Merchant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'business_name', type: 'varchar', length: 255 })
  businessName!: string;

  @Index('idx_merchants_email', { unique: true })
  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: MerchantStatus.ACTIVE,
  })
  status!: MerchantStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
