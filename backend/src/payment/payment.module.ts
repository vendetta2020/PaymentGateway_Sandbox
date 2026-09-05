import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { IdempotencyKey } from './entities/idempotency-key.entity';
import { PaymentService } from './services/payment.service';
import { IdempotencyService } from './services/idempotency.service';
import { PaymentController } from './controllers/payment.controller';
import { InternalPaymentController } from './controllers/internal-payment.controller';
import { SimulatedPaymentProvider } from './providers/simulated-payment.provider';
import { AuthModule } from '../auth/auth.module';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment, IdempotencyKey]), AuthModule, WebhookModule],
  controllers: [PaymentController, InternalPaymentController],
  providers: [
    PaymentService,
    IdempotencyService,
    {
      provide: 'PAYMENT_PROVIDER',
      useClass: SimulatedPaymentProvider,
    },
  ],
  exports: [PaymentService, IdempotencyService, 'PAYMENT_PROVIDER'],
})
export class PaymentModule {}
