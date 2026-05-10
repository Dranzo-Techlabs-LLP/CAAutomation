import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEnum, IsISO8601, IsNumberString, IsOptional, IsString, IsUUID, Length, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { GstTreatment } from '../invoice.entity';

export class CreateInvoiceLineItemDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  taskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsString()
  quantity!: string;

  @ApiProperty({ description: 'Rate in paise per unit' })
  @IsString()
  rate!: string;

  @ApiProperty({ description: 'Taxable value in paise (qty * rate)' })
  @IsString()
  amount!: string;

  @ApiPropertyOptional({ description: 'HSN/SAC code' })
  @IsOptional()
  @IsString()
  hsnSac?: string;

  @ApiPropertyOptional({ description: 'GST rate (0/5/12/18/28). Default 18' })
  @IsOptional()
  @IsNumberString()
  gstRate?: string;

  @ApiPropertyOptional({ description: 'Cess rate' })
  @IsOptional()
  @IsNumberString()
  cessRate?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsISO8601()
  issueDate!: string;

  @ApiProperty()
  @IsISO8601()
  dueDate!: string;

  @ApiProperty({ type: [CreateInvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateInvoiceLineItemDto)
  lineItems!: CreateInvoiceLineItemDto[];

  @ApiPropertyOptional({ enum: GstTreatment, default: GstTreatment.Regular })
  @IsOptional()
  @IsEnum(GstTreatment)
  gstTreatment?: GstTreatment;

  @ApiPropertyOptional({ description: '2-digit place of supply state code; if omitted derived from customer GSTIN' })
  @IsOptional()
  @IsString()
  @Length(2, 5)
  placeOfSupply?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reverseCharge?: boolean;

  @ApiPropertyOptional({ description: 'TDS rate (e.g. 10 for 10%)' })
  @IsOptional()
  @IsNumberString()
  tdsRate?: string;

  @ApiPropertyOptional({ description: 'TDS section (e.g. 194J)' })
  @IsOptional()
  @IsString()
  tdsSection?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;
}
