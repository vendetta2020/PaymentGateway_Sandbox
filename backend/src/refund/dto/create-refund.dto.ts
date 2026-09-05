import { IsInt, Min, IsString, IsOptional, MaxLength, Length } from 'class-validator';

export class CreateRefundDto {
  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsOptional()
  @Length(3, 3)
  currency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  reason?: string;
}
