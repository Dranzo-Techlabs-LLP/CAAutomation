import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { PaymentMode } from '../payment.entity';
import { PaymentAdviceType } from '../payment-advice.entity';

export class CreatePaymentAdviceDto {
  @ApiProperty()
  @IsISO8601()
  adviceDate!: string;

  @ApiProperty({ enum: PaymentAdviceType })
  @IsEnum(PaymentAdviceType)
  type!: PaymentAdviceType;

  @ApiPropertyOptional({ description: 'Customer ID (for received type, optional for made)' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Vendor / party name override (for made type)' })
  @IsOptional()
  @IsString()
  partyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyGstin?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyPan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  partyAddress?: string;

  @ApiPropertyOptional({ description: 'Linked invoice ID (optional)' })
  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @ApiProperty({ description: 'Gross amount in paise' })
  @IsNumberString()
  grossAmount!: string;

  @ApiPropertyOptional({ description: 'TDS amount in paise' })
  @IsOptional()
  @IsNumberString()
  tdsAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tdsSection?: string;

  @ApiPropertyOptional({ description: 'TDS rate %' })
  @IsOptional()
  @IsNumberString()
  tdsRate?: string;

  @ApiPropertyOptional({ description: 'Other deductions in paise' })
  @IsOptional()
  @IsNumberString()
  otherDeductions?: string;

  @ApiProperty({ enum: PaymentMode })
  @IsEnum(PaymentMode)
  mode!: PaymentMode;

  @ApiPropertyOptional({ description: 'UTR / cheque / txn id' })
  @IsOptional()
  @IsString()
  referenceNo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  transactionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  narration?: string;
}
