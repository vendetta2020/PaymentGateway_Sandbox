import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIdempotencyKeysTable1788609702391 implements MigrationInterface {
    name = 'CreateIdempotencyKeysTable1788609702391'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "idempotency_keys" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "key" character varying(255) NOT NULL, "request_hash" character varying(255) NOT NULL, "api_path" character varying(255) NOT NULL, "response_status" integer NOT NULL, "response_body" jsonb NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8ad20779ad0411107a56e53d0f6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_idempotency_merchant_key" ON "idempotency_keys"  ("merchant_id", "key") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_idempotency_merchant_key"`);
        await queryRunner.query(`DROP TABLE "idempotency_keys"`);
    }

}
