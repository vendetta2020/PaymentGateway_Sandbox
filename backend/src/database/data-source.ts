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
 *   npx typeorm-ts-node-commonjs migration:generate src/database/migrations/MigrationName -d src/database/data-source.ts
 */
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'paymentgw',
  password: process.env.DB_PASSWORD || 'paymentgw_secret',
  database: process.env.DB_NAME || 'payment_gateway',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
