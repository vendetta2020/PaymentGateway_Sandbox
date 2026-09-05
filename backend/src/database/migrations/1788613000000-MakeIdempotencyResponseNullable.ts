import { MigrationInterface, QueryRunner } from 'typeorm';

export class MakeIdempotencyResponseNullable1788613000000 implements MigrationInterface {
  name = 'MakeIdempotencyResponseNullable1788613000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "response_status" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "response_body" DROP NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "response_body" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "idempotency_keys" ALTER COLUMN "response_status" SET NOT NULL`,
    );
  }
}
