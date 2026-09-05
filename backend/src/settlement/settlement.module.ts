import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Settlement } from './entities/settlement.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Refund } from '../refund/entities/refund.entity';
import { SettlementService } from './services/settlement.service';
import { SettlementController } from './controllers/settlement.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Settlement, Payment, Refund]), AuthModule],
  controllers: [SettlementController],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
