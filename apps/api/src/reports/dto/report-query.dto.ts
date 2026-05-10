import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBooleanString, IsDateString, IsOptional, IsString } from 'class-validator';

export class ReportQueryDto {
  @ApiPropertyOptional({ description: 'ISO date (inclusive)', example: '2026-05-01' })
  @IsDateString()
  from!: string;

  @ApiPropertyOptional({ description: 'ISO date (inclusive end-of-day)', example: '2026-05-31' })
  @IsDateString()
  to!: string;

  @ApiPropertyOptional({ description: 'Filter to single staff user' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter to single client/customer' })
  @IsOptional()
  @IsString()
  customerId?: string;

  @ApiPropertyOptional({ description: 'If true, include only billable work' })
  @IsOptional()
  @IsBooleanString()
  billableOnly?: string;
}
