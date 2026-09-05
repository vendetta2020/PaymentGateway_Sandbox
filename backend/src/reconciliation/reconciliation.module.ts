import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationRun } from './entities/reconciliation-run.entity';
import { ReconciliationResult } from './entities/reconciliation-result.entity';
import { Payment } from '../payment/entities/payment.entity';
import { ReconciliationService } from './services/reconciliation.service';
import { ReconciliationController } from './controllers/reconciliation.controller';
import { AuthModule } from '../auth/auth.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ReconciliationRun, ReconciliationResult, Payment]),
    AuthModule,
    PaymentModule,
  ],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
