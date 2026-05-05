import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { EnquirySource } from '../../customers/customer.entity';
import { EnquiryStatus } from '../enquiry.entity';

export class UpdateEnquiryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  brief?: string;

  @ApiPropertyOptional({ enum: EnquirySource })
  @IsOptional()
  @IsEnum(EnquirySource)
  source?: EnquirySource;

  @ApiPropertyOptional({ description: 'Amount in paise' })
  @IsOptional()
  @IsString()
  proposalAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalDocUrl?: string;

  @ApiPropertyOptional({ enum: EnquiryStatus })
  @IsOptional()
  @IsEnum(EnquiryStatus)
  status?: EnquiryStatus;

  @ApiPropertyOptional()
  @IsOptional()
  requirementsJson?: Record<string, unknown>;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}
