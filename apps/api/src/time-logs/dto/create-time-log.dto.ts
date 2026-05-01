import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTimeLogDto {
  @ApiProperty()
  @IsUUID()
  taskId!: string;

  @ApiProperty()
  @IsISO8601()
  startedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isBillable?: boolean;

  @ApiPropertyOptional({ description: 'Hourly rate in paise' })
  @IsOptional()
  @IsString()
  hourlyRate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
