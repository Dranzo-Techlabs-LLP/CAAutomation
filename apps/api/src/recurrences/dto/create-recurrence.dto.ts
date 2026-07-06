import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsISO8601, IsInt, IsObject, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { AssignmentStrategy, RecurrencePatternType } from '../task-recurrence.entity';

export class CreateRecurrenceDto {
  @ApiProperty()
  @IsUUID()
  serviceId!: string;

  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: RecurrencePatternType })
  @IsEnum(RecurrencePatternType)
  patternType!: RecurrencePatternType;

  @ApiProperty()
  @IsString()
  patternExpression!: string;

  @ApiPropertyOptional({ default: 'Asia/Kolkata' })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiProperty()
  @IsISO8601()
  startDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @IsInt()
  @Min(0)
  generateLeadDays?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  preventOverlap?: boolean;

  @ApiProperty()
  @IsObject()
  templateJson!: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workflowId?: string;

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsUUID('4', { each: true })
  notifyOnCreateUserIdsJson?: string[];
}
