import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPaymentMethodToPayments1788584717959 implements MigrationInterface {
  name = 'AddPaymentMethodToPayments1788584717959';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "payment_method" character varying(50) NOT NULL DEFAULT 'QRIS'`,
    );
    await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "payment_method" DROP DEFAULT`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD "provider_reference" character varying(255)`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "UQ_de9cb5e46ac2a317daf1e201d24" UNIQUE ("provider_reference")`,
    );
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_method" CHECK (payment_method IN ('QRIS', 'VIRTUAL_ACCOUNT', 'EWALLET', 'CARD'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_method"`);
    await queryRunner.query(
      `ALTER TABLE "payments" DROP CONSTRAINT "UQ_de9cb5e46ac2a317daf1e201d24"`,
    );
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "provider_reference"`);
    await queryRunner.query(`ALTER TABLE "payments" DROP COLUMN "payment_method"`);
  }
}
