import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiCredentialsTable1788576059645 implements MigrationInterface {
  name = 'CreateApiCredentialsTable1788576059645';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "api_credentials" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "merchant_id" uuid NOT NULL, "public_key" character varying(255) NOT NULL, "secret_hash" character varying(255) NOT NULL, "status" character varying(50) NOT NULL DEFAULT 'ACTIVE', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_3e97de2b2f8c5d0897b67e89e3c" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_4d50b6a4a7f09db4adb707dd05" ON "api_credentials" ("public_key") `,
    );
    await queryRunner.query(
      `ALTER TABLE "api_credentials" ADD CONSTRAINT "FK_fcac1777897d4146a4585313718" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_credentials" ADD CONSTRAINT "chk_api_credentials_status" CHECK (status IN ('ACTIVE', 'REVOKED'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "api_credentials" DROP CONSTRAINT "chk_api_credentials_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "api_credentials" DROP CONSTRAINT "FK_fcac1777897d4146a4585313718"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_4d50b6a4a7f09db4adb707dd05"`);
    await queryRunner.query(`DROP TABLE "api_credentials"`);
  }
}
