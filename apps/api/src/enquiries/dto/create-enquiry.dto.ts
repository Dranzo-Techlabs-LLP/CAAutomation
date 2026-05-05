import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EnquirySource } from '../../customers/customer.entity';

export class CreateEnquiryDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty({ enum: EnquirySource })
  @IsEnum(EnquirySource)
  source!: EnquirySource;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brief?: string;

  @ApiPropertyOptional()
  @IsOptional()
  requirementsJson?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralContact?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referralDetails?: string;
}
