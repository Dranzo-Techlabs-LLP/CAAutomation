import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { EnquiryStatus } from '../enquiry.entity';

export class UpdateEnquiryStatusDto {
  @ApiProperty({ enum: EnquiryStatus })
  @IsEnum(EnquiryStatus)
  status!: EnquiryStatus;

  @ApiPropertyOptional({ description: 'Amount in paise' })
  @IsOptional()
  @IsString()
  proposalAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  proposalDocUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lostReason?: string;
}
