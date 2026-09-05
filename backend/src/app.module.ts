import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/config.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MerchantModule } from './merchant/merchant.module';

@Module({
  imports: [
    // Configuration — loaded first, available globally
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),

    // Infrastructure
    DatabaseModule,

    // API modules
    HealthModule,
    MerchantModule,
  ],
})
export class AppModule {}
