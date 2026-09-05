import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, QueryFailedError, EntityManager } from 'typeorm';
import { IdempotencyKey } from '../entities/idempotency-key.entity';

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKey)
    private readonly idempotencyKeyRepository: Repository<IdempotencyKey>,
    private readonly dataSource: DataSource,
  ) {}

  async executeIdempotent<T>(
    merchantId: string,
    key: string,
    requestHash: string,
    apiPath: string,
    operation: (manager: EntityManager) => Promise<{ status: number; body: T }>,
  ): Promise<{ status: number; body: T }> {
    // 1. Try to fetch existing completed or in-progress idempotency record
    let record = await this.idempotencyKeyRepository.findOne({
      where: { merchantId, key },
    });

    if (record) {
      if (record.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key used with a different request payload');
      }
      return { status: record.responseStatus, body: record.responseBody };
    }

    // 2. Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Execute business logic within the transaction
      const result = await operation(queryRunner.manager);

      // 4. Save idempotency key within the SAME transaction
      const newRecord = this.idempotencyKeyRepository.create({
        merchantId,
        key,
        requestHash,
        apiPath,
        responseStatus: result.status,
        responseBody: result.body,
      });

      await queryRunner.manager.save(newRecord);
      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      // 5. Rollback on ANY error (business, validation, or db unique violation)
      await queryRunner.rollbackTransaction();

      // 6. Handle concurrent insert detection
      if (error instanceof QueryFailedError && (error as any).code === '23505') {
        const constraintName = (error as any).constraint;
        if (constraintName === 'idx_idempotency_merchant_key') {
          // Another transaction successfully committed this key first!
          const existing = await this.idempotencyKeyRepository.findOne({
            where: { merchantId, key },
          });

          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new ConflictException('Idempotency key used with a different request payload');
            }
            return { status: existing.responseStatus, body: existing.responseBody };
          }
        }
      }
      
      // Rethrow if it's a business logic error (e.g. orderId unique violation, or validation)
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
