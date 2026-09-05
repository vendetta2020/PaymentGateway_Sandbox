import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class CreateSettlementDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string;
}
