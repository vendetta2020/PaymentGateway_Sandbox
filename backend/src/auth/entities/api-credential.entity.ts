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
import { ApiCredentialStatus } from '../enums/api-credential-status.enum';

@Entity('api_credentials')
export class ApiCredential {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @ManyToOne(() => Merchant)
  @JoinColumn({ name: 'merchant_id' })
  merchant!: Merchant;

  @Index({ unique: true })
  @Column({ name: 'public_key', type: 'varchar', length: 255 })
  publicKey!: string;

  @Column({ name: 'secret_hash', type: 'varchar', length: 255 })
  secretHash!: string;

  @Column({
    type: 'varchar',
    length: 50,
    default: ApiCredentialStatus.ACTIVE,
  })
  status!: ApiCredentialStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
