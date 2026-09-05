import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateWebhookTables1788620888098 implements MigrationInterface {
  name = 'CreateWebhookTables1788620888098';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "merchant_webhook_configs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "endpoint_url" character varying(500) NOT NULL, "signing_secret" character varying(255) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "chk_webhook_configs_status" CHECK (status IN ('ACTIVE', 'DISABLED')), CONSTRAINT "PK_508ad49783d4f1af0dc3af78e6b" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_configs_merchant_status" ON "merchant_webhook_configs"  ("merchant_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "payment_id" uuid NOT NULL, "event_type" character varying(100) NOT NULL, "event_key" character varying(255) NOT NULL, "payload" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_4cba37e6a0acb5e1fc49c34ebfd" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_events_payment" ON "webhook_events"  ("payment_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_webhook_events_merchant_event_key" ON "webhook_events"  ("merchant_id", "event_key") `,
    );
    await queryRunner.query(
      `CREATE TABLE "webhook_deliveries" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "webhook_event_id" uuid NOT NULL, "webhook_config_id" uuid NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "attempt_count" integer NOT NULL DEFAULT '0', "next_attempt_at" TIMESTAMP, "last_attempt_at" TIMESTAMP, "last_http_status" integer, "last_error" character varying(500), "delivered_at" TIMESTAMP, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "chk_webhook_deliveries_status" CHECK (status IN ('PENDING', 'DELIVERING', 'DELIVERED', 'FAILED', 'EXHAUSTED')), CONSTRAINT "PK_535dd409947fb6d8fc6dfc0112a" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_deliveries_status" ON "webhook_deliveries"  ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_deliveries_config" ON "webhook_deliveries"  ("webhook_config_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_webhook_deliveries_event" ON "webhook_deliveries"  ("webhook_event_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_webhook_configs" ADD CONSTRAINT "FK_17442a29c88bc038064fba94236" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_2fdced0e756c991d6dcc4967d85" FOREIGN KEY ("webhook_event_id") REFERENCES "webhook_events"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "FK_4e7317ad3827b4a765e4162fcf9" FOREIGN KEY ("webhook_config_id") REFERENCES "merchant_webhook_configs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_4e7317ad3827b4a765e4162fcf9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "FK_2fdced0e756c991d6dcc4967d85"`,
    );
    await queryRunner.query(
      `ALTER TABLE "merchant_webhook_configs" DROP CONSTRAINT "FK_17442a29c88bc038064fba94236"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_deliveries_event"`);
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_deliveries_config"`);
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_deliveries_status"`);
    await queryRunner.query(`DROP TABLE "webhook_deliveries"`);
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_events_merchant_event_key"`);
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_events_payment"`);
    await queryRunner.query(`DROP TABLE "webhook_events"`);
    await queryRunner.query(`DROP INDEX "public"."idx_webhook_configs_merchant_status"`);
    await queryRunner.query(`DROP TABLE "merchant_webhook_configs"`);
  }
}
