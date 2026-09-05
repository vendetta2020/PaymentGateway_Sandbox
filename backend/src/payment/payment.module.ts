import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { InternalPaymentController } from './controllers/internal-payment.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), AuthModule],
  controllers: [PaymentController, InternalPaymentController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
