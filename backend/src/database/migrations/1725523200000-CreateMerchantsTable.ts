import { MigrationInterface, QueryRunner, Table, TableCheck } from 'typeorm';

export class CreateMerchantsTable1725523200000 implements MigrationInterface {
  name = 'CreateMerchantsTable1725523200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure pgcrypto extension is enabled for gen_random_uuid()
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

    await queryRunner.createTable(
      new Table({
        name: 'merchants',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'business_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            isNullable: false,
            default: "'ACTIVE'",
          },
          {
            name: 'created_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'updated_at',
            type: 'timestamptz',
            isNullable: false,
            default: 'now()',
          },
        ],
      }),
      true,
    );

    // Enforce case-insensitive uniqueness on email at database level
    // Single non-redundant index on LOWER(email)
    await queryRunner.query(
      'CREATE UNIQUE INDEX "idx_merchants_email_lower" ON "merchants" (LOWER("email"))',
    );

    // Add check constraint to enforce status invariant at database level
    await queryRunner.createCheckConstraint(
      'merchants',
      new TableCheck({
        name: 'chk_merchants_status',
        expression: "status IN ('ACTIVE', 'SUSPENDED', 'INACTIVE')",
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropCheckConstraint('merchants', 'chk_merchants_status');
    await queryRunner.query('DROP INDEX IF EXISTS "idx_merchants_email_lower"');
    await queryRunner.dropTable('merchants', true);
  }
}
