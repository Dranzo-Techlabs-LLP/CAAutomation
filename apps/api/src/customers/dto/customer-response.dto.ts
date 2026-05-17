import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerStatus, CustomerType, EnquirySource } from '../customer.entity';

export class CustomerResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty({ enum: CustomerType })
  type!: CustomerType;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  contactNo?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  gstin?: string | null;

  @ApiPropertyOptional()
  pan?: string | null;

  @ApiPropertyOptional()
  address?: string | null;

  @ApiProperty({ enum: EnquirySource })
  enquirySource!: EnquirySource;

  @ApiProperty({ enum: CustomerStatus })
  status!: CustomerStatus;

  @ApiPropertyOptional()
  briefText?: string | null;

  @ApiPropertyOptional()
  requirementsJson?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  ownerUserId?: string | null;

  @ApiPropertyOptional()
  defaultTeamId?: string | null;

  @ApiPropertyOptional()
  onboardedAt?: Date | null;
}
