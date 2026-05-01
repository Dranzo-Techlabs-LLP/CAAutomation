import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EnquirySource } from '../../customers/customer.entity';
import { EnquiryStatus } from '../enquiry.entity';

export class EnquiryResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiProperty({ enum: EnquirySource })
  source!: EnquirySource;

  @ApiPropertyOptional()
  brief?: string | null;

  @ApiProperty({ enum: EnquiryStatus })
  status!: EnquiryStatus;

  @ApiPropertyOptional()
  proposalAmount?: string | null;

  @ApiPropertyOptional()
  proposalDocUrl?: string | null;

  @ApiPropertyOptional()
  lostReason?: string | null;

  @ApiPropertyOptional()
  convertedAt?: Date | null;
}
