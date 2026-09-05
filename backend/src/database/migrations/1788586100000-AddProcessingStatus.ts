import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcessingStatus1788586100000 implements MigrationInterface {
    name = 'AddProcessingStatus1788586100000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_status"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_status" CHECK (status IN ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "payments" DROP CONSTRAINT "chk_payments_status"`);
        await queryRunner.query(`ALTER TABLE "payments" ADD CONSTRAINT "chk_payments_status" CHECK (status IN ('PENDING', 'SUCCEEDED', 'FAILED', 'EXPIRED', 'CANCELLED'))`);
    }
}
