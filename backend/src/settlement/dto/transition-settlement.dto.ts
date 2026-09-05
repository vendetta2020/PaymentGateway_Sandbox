import { IsEnum } from 'class-validator';
import { SettlementStatus } from '../enums/settlement-status.enum';

export class TransitionSettlementDto {
  @IsEnum(SettlementStatus)
  status!: SettlementStatus;
}
