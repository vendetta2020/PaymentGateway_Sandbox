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
    // 1. Try to fetch existing completed idempotency record
    const record = await this.idempotencyKeyRepository.findOne({
      where: { merchantId, key },
    });

    if (record) {
      if (record.requestHash !== requestHash) {
        throw new ConflictException('Idempotency key used with a different request payload');
      }
      if (record.responseStatus != null) {
        return { status: record.responseStatus, body: record.responseBody };
      }
    }

    // 2. Start a transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Atomically insert placeholder FIRST inside the transaction.
      // This immediately locks the unique index tuple (merchant_id, key) in PostgreSQL,
      // forcing any concurrent request with the same key to wait.
      const placeholder = this.idempotencyKeyRepository.create({
        merchantId,
        key,
        requestHash,
        apiPath,
        responseStatus: null,
        responseBody: null,
      });

      try {
        await queryRunner.manager.save(placeholder);
      } catch (insertError) {
        await queryRunner.rollbackTransaction();

        // 4. Handle concurrent duplicate insert
        if (insertError instanceof QueryFailedError && (insertError as any).code === '23505') {
          const constraintName = (insertError as any).constraint;
          if (constraintName === 'idx_idempotency_merchant_key') {
            // Another concurrent transaction already claimed this key and will commit or has committed!
            // Poll for the winning transaction's committed record.
            let existing = await this.idempotencyKeyRepository.findOne({
              where: { merchantId, key },
            });

            let attempts = 0;
            while ((!existing || existing.responseStatus == null) && attempts < 40) {
              await new Promise((resolve) => setTimeout(resolve, 50));
              existing = await this.idempotencyKeyRepository.findOne({
                where: { merchantId, key },
              });
              attempts++;
            }

            if (existing) {
              if (existing.requestHash !== requestHash) {
                throw new ConflictException(
                  'Idempotency key used with a different request payload',
                );
              }
              if (existing.responseStatus != null) {
                return { status: existing.responseStatus, body: existing.responseBody };
              }
            }
          }
        }
        throw insertError;
      }

      // 5. Execute business logic within the SAME transaction.
      // Only the winning thread reaches here.
      const result = await operation(queryRunner.manager);

      // 6. Update the placeholder record with final response status & body
      placeholder.responseStatus = result.status;
      placeholder.responseBody = result.body;
      await queryRunner.manager.save(placeholder);

      // 7. Commit the transaction atomically
      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      try {
        await queryRunner.rollbackTransaction();
      } catch {
        // transaction may have already rolled back
      }
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
