import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('idempotency_keys')
@Index('idx_idempotency_merchant_key', ['merchantId', 'key'], { unique: true })
export class IdempotencyKey {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'merchant_id', type: 'uuid' })
  merchantId!: string;

  @Column({ type: 'varchar', length: 255 })
  key!: string;

  @Column({ name: 'request_hash', type: 'varchar', length: 255 })
  requestHash!: string;

  @Column({ name: 'api_path', type: 'varchar', length: 255 })
  apiPath!: string;

  @Column({ name: 'response_status', type: 'int', nullable: true })
  responseStatus!: number | null;

  @Column({ name: 'response_body', type: 'jsonb', nullable: true })
  responseBody!: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
