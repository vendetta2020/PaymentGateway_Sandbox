import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateRefundsTable1788629900000 implements MigrationInterface {
  name = 'CreateRefundsTable1788629900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "refunds" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "payment_id" uuid NOT NULL,
        "amount" bigint NOT NULL,
        "currency" character varying(3) NOT NULL,
        "reason" character varying(255),
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "provider_reference" character varying(255),
        "idempotency_key" character varying(255),
        "processed_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "chk_refunds_status" CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
        CONSTRAINT "chk_refunds_amount" CHECK (amount > 0),
        CONSTRAINT "chk_refunds_currency" CHECK (length(currency) = 3),
        CONSTRAINT "UQ_refunds_provider_reference" UNIQUE ("provider_reference"),
        CONSTRAINT "PK_refunds_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(`CREATE INDEX "idx_refunds_payment" ON "refunds" ("payment_id")`);
    await queryRunner.query(`CREATE INDEX "idx_refunds_merchant" ON "refunds" ("merchant_id")`);
    await queryRunner.query(`CREATE INDEX "idx_refunds_status" ON "refunds" ("status")`);
    await queryRunner.query(
      `CREATE INDEX "idx_refunds_merchant_idempotency" ON "refunds" ("merchant_id", "idempotency_key")`,
    );

    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "refunds" ADD CONSTRAINT "FK_refunds_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_payment"`);
    await queryRunner.query(`ALTER TABLE "refunds" DROP CONSTRAINT "FK_refunds_merchant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refunds_merchant_idempotency"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refunds_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refunds_merchant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_refunds_payment"`);
    await queryRunner.query(`DROP TABLE "refunds"`);
  }
}
