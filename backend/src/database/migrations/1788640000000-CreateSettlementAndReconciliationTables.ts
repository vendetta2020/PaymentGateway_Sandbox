import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSettlementAndReconciliationTables1788640000000 implements MigrationInterface {
  name = 'CreateSettlementAndReconciliationTables1788640000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Settlements table
    await queryRunner.query(
      `CREATE TABLE "settlements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "currency" character varying(3) NOT NULL,
        "gross_amount" bigint NOT NULL,
        "refund_amount" bigint NOT NULL DEFAULT 0,
        "net_amount" bigint NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "settlement_reference" character varying(255) NOT NULL,
        "period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
        "period_end" TIMESTAMP WITH TIME ZONE NOT NULL,
        "settled_at" TIMESTAMP WITH TIME ZONE,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "chk_settlements_status" CHECK (status IN ('PENDING', 'PROCESSING', 'SETTLED', 'FAILED')),
        CONSTRAINT "chk_settlements_amounts" CHECK (gross_amount >= 0 AND refund_amount >= 0),
        CONSTRAINT "chk_settlements_currency" CHECK (length(currency) = 3),
        CONSTRAINT "chk_settlements_period" CHECK (period_end >= period_start),
        CONSTRAINT "UQ_settlements_reference" UNIQUE ("settlement_reference"),
        CONSTRAINT "UQ_settlements_merchant_period_currency" UNIQUE ("merchant_id", "period_start", "period_end", "currency"),
        CONSTRAINT "PK_settlements_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_settlements_merchant" ON "settlements" ("merchant_id")`,
    );
    await queryRunner.query(`CREATE INDEX "idx_settlements_status" ON "settlements" ("status")`);
    await queryRunner.query(
      `ALTER TABLE "settlements" ADD CONSTRAINT "FK_settlements_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 2. Reconciliation Runs table
    await queryRunner.query(
      `CREATE TABLE "reconciliation_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "merchant_id" uuid NOT NULL,
        "period_start" TIMESTAMP WITH TIME ZONE NOT NULL,
        "period_end" TIMESTAMP WITH TIME ZONE NOT NULL,
        "status" character varying(50) NOT NULL DEFAULT 'PENDING',
        "total_internal_amount" bigint NOT NULL DEFAULT 0,
        "total_provider_amount" bigint NOT NULL DEFAULT 0,
        "matched_count" integer NOT NULL DEFAULT 0,
        "discrepancy_count" integer NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "completed_at" TIMESTAMP WITH TIME ZONE,
        CONSTRAINT "chk_reconciliation_runs_status" CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
        CONSTRAINT "chk_reconciliation_runs_period" CHECK (period_end >= period_start),
        CONSTRAINT "chk_reconciliation_runs_amounts" CHECK (total_internal_amount >= 0 AND total_provider_amount >= 0),
        CONSTRAINT "chk_reconciliation_runs_counts" CHECK (matched_count >= 0 AND discrepancy_count >= 0),
        CONSTRAINT "UQ_reconciliation_runs_merchant_period" UNIQUE ("merchant_id", "period_start", "period_end"),
        CONSTRAINT "PK_reconciliation_runs_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_reconciliation_runs_merchant" ON "reconciliation_runs" ("merchant_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reconciliation_runs_status" ON "reconciliation_runs" ("status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_runs" ADD CONSTRAINT "FK_reconciliation_runs_merchant" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // 3. Reconciliation Results table
    await queryRunner.query(
      `CREATE TABLE "reconciliation_results" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "reconciliation_run_id" uuid NOT NULL,
        "provider_reference" character varying(255),
        "payment_id" uuid,
        "discrepancy_type" character varying(50) NOT NULL,
        "internal_amount" bigint,
        "provider_amount" bigint,
        "internal_currency" character varying(3),
        "provider_currency" character varying(3),
        "internal_status" character varying(50),
        "provider_status" character varying(50),
        "details" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "chk_reconciliation_discrepancy_type" CHECK (discrepancy_type IN ('MATCHED', 'MISSING_IN_PROVIDER', 'MISSING_IN_INTERNAL', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'STATUS_MISMATCH', 'DUPLICATE_PROVIDER_REFERENCE')),
        CONSTRAINT "PK_reconciliation_results_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "idx_reconciliation_results_run" ON "reconciliation_results" ("reconciliation_run_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_reconciliation_results_type" ON "reconciliation_results" ("discrepancy_type")`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_results" ADD CONSTRAINT "FK_reconciliation_results_run" FOREIGN KEY ("reconciliation_run_id") REFERENCES "reconciliation_runs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_results" ADD CONSTRAINT "FK_reconciliation_results_payment" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "reconciliation_results" DROP CONSTRAINT "FK_reconciliation_results_payment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "reconciliation_results" DROP CONSTRAINT "FK_reconciliation_results_run"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_reconciliation_results_type"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reconciliation_results_run"`);
    await queryRunner.query(`DROP TABLE "reconciliation_results"`);

    await queryRunner.query(
      `ALTER TABLE "reconciliation_runs" DROP CONSTRAINT "FK_reconciliation_runs_merchant"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_reconciliation_runs_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_reconciliation_runs_merchant"`);
    await queryRunner.query(`DROP TABLE "reconciliation_runs"`);

    await queryRunner.query(`ALTER TABLE "settlements" DROP CONSTRAINT "FK_settlements_merchant"`);
    await queryRunner.query(`DROP INDEX "public"."idx_settlements_status"`);
    await queryRunner.query(`DROP INDEX "public"."idx_settlements_merchant"`);
    await queryRunner.query(`DROP TABLE "settlements"`);
  }
}
