import { IsInt, Min, IsString, IsUppercase, Length, MaxLength, IsOptional, IsDateString } from 'class-validator';

export class CreatePaymentDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @IsUppercase()
  @Length(3, 3)
  currency!: string;

  @IsString()
  @MaxLength(255)
  orderId!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
