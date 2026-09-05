import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MerchantStatus } from '../enums/merchant-status.enum';

/**
 * Merchant entity representing businesses utilizing the payment gateway.
 *
 * Design considerations:
 * - ID is UUIDv4 for distributed uniqueness and security against enumeration.
 * - Email uniqueness is enforced at database level via case-insensitive index on LOWER(email).
 * - BusinessName represents the official trading entity.
 * - Status lifecycle is constrained by MerchantStatus enum and DB check constraint.
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

  @Column({ type: 'varchar', length: 255 })
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
