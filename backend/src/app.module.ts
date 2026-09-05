import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/config.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MerchantModule } from './merchant/merchant.module';
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payment/payment.module';

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
    AuthModule,
    PaymentModule,
  ],
})
export class AppModule {}
