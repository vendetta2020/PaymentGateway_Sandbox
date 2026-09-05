import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangePaymentAmountToBigint1788583432079 implements MigrationInterface {
  name = 'ChangePaymentAmountToBigint1788583432079';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_amount"`);
    await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE bigint`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount" CHECK (amount >= 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_amount"`);
    await queryRunner.query(`ALTER TABLE "payments" ALTER COLUMN "amount" TYPE integer`);
    await queryRunner.query(
      `ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_amount" CHECK (amount >= 0)`,
    );
  }
}
