import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
import { RecurrenceDefault } from '../service-catalog.entity';

export class CreateServiceCatalogDto {
  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultWorkflowId?: string;

  @ApiPropertyOptional({ description: 'Default billing amount in paise' })
  @IsOptional()
  @IsString()
  defaultBillingAmount?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  defaultTeamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultAssigneeStrategy?: string;

  @ApiPropertyOptional({ enum: RecurrenceDefault })
  @IsOptional()
  @IsEnum(RecurrenceDefault)
  recurrenceDefault?: RecurrenceDefault;

  @ApiPropertyOptional({ description: 'HSN/SAC code for invoicing' })
  @IsOptional()
  @IsString()
  hsnSac?: string;

  @ApiPropertyOptional({ description: 'Default GST rate %' })
  @IsOptional()
  @IsNumberString()
  defaultGstRate?: string;
}
