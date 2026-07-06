import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize, IsArray, IsBoolean, IsEnum, IsISO8601, IsInt, IsOptional, IsString, IsUUID, Max, Min, ValidateNested,
} from 'class-validator';
import { AssignmentStrategy, RecurrencePatternType } from '../task-recurrence.entity';

/** One party (customer) in a bulk recurring setup, with optional per-party overrides. */
export class BulkRecurrencePartyDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  /** Per-party due day of month (1–31). Overrides the shared dueDay when set. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay?: number;

  /** Per-party pattern override, e.g. quarterly for QRMP filers. */
  @ApiPropertyOptional({ enum: RecurrencePatternType })
  @IsOptional()
  @IsEnum(RecurrencePatternType)
  patternType?: RecurrencePatternType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  generateLeadDays?: number;
}

/**
 * Set up ONE recurring statutory task (e.g. GSTR-1) across MANY parties at once.
 * Fans out to one TaskRecurrence per party, each with its own due day / pattern.
 */
export class BulkCreateRecurrenceDto {
  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: RecurrencePatternType })
  @IsEnum(RecurrencePatternType)
  patternType!: RecurrencePatternType;

  /** Shared due day of month (1–31), used when a party doesn't override it. */
  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(31)
  dueDay!: number;

  @ApiProperty()
  @IsISO8601()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsInt()
  @Min(0)
  generateLeadDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  preventOverlap?: boolean;

  @ApiProperty({ enum: AssignmentStrategy })
  @IsEnum(AssignmentStrategy)
  assignmentStrategy!: AssignmentStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignmentTargetUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignmentTargetTeamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignmentTargetRoleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  templateJson?: Record<string, unknown>;

  @ApiProperty({ type: [BulkRecurrencePartyDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BulkRecurrencePartyDto)
  parties!: BulkRecurrencePartyDto[];
}
