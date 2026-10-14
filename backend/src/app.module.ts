import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateConfig } from './config/config.validation';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { MerchantModule } from './merchant/merchant.module';
import { AuthModule } from './auth/auth.module';
import { PaymentModule } from './payment/payment.module';
import { WebhookModule } from './webhook/webhook.module';
import { RefundModule } from './refund/refund.module';
import { SettlementModule } from './settlement/settlement.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    // Configuration — loaded first, available globally
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateConfig,
    }),

    // Infrastructure
    CommonModule,
    DatabaseModule,

    // API modules
    HealthModule,
    MerchantModule,
    AuthModule,
    PaymentModule,
    WebhookModule,
    RefundModule,
    SettlementModule,
    ReconciliationModule,
  ],
})
export class AppModule {}
