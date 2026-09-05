import { IsEnum } from 'class-validator';
import { PaymentStatus } from '../enums/payment-status.enum';

export class TransitionPaymentDto {
  @IsEnum(PaymentStatus)
  status!: PaymentStatus;
}
