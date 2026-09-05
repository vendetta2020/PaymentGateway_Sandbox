import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

/**
 * Standalone DataSource configuration for TypeORM CLI.
 *
 * Used for running migrations outside the NestJS application context:
 *   npm run migration:run
 *   npm run migration:revert
 *
 * For generating migrations, run:
 *   npm run migration:generate -- src/database/migrations/MigrationName
 */
dotenv.config();

if (
  !process.env.DB_HOST ||
  !process.env.DB_USERNAME ||
  !process.env.DB_PASSWORD ||
  !process.env.DB_NAME
) {
  throw new Error(
    'Missing required database environment variables (DB_HOST, DB_USERNAME, DB_PASSWORD, DB_NAME)',
  );
}

const dbPort = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: dbPort,
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
