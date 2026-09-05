import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class CreateReconciliationDto {
  @IsISO8601()
  periodStart!: string;

  @IsISO8601()
  periodEnd!: string;

  @IsString()
  @IsOptional()
  scenario?: string;
}
