import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentsTable1788580907583 implements MigrationInterface {
    name = 'CreatePaymentsTable1788580907583'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "payments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "amount" integer NOT NULL, "currency" character varying(3) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'PENDING', "order_id" character varying(255) NOT NULL, "description" character varying(255), "expires_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_197ab7af18c93fbb0c9b28b4a59" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "idx_payments_merchant_order" ON "payments" ("merchant_id", "order_id")`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "FK_c4a9a77d8ec9c37d3654a0d2ebc" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount" CHECK (amount >= 0)`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_status" CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_status"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_amount"`);
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "FK_c4a9a77d8ec9c37d3654a0d2ebc"`);
        await queryRunner.query(`DROP INDEX "public"."idx_payments_merchant_order"`);
        await queryRunner.query(`DROP TABLE "payments"`);
    }

}
