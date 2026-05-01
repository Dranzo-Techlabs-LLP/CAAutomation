import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { PaymentMode } from '../payment.entity';

export class RecordPaymentDto {
  @ApiProperty()
  @IsISO8601()
  paidOn!: string;

  @ApiProperty({ description: 'Amount in paise' })
  @IsString()
  amount!: string;

  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNo?: string;
}
