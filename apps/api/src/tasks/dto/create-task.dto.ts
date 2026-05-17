import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsISO8601, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskGeneratedBy, TaskPriority } from '../task.entity';

export class CreateTaskDto {
  @ApiProperty()
  @IsUUID()
  customerId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parentTaskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  workflowId?: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  resolution?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reviewComments?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedToUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assignedTeamId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  staffDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  reviewDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  clientDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  estimatedHours?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  billable?: boolean;

  @ApiPropertyOptional({ description: 'Amount in paise' })
  @IsOptional()
  @IsString()
  billingAmount?: string;

  @ApiPropertyOptional({ description: 'Per-hour rate in paise (overrides service default)' })
  @IsOptional()
  @IsString()
  hourlyRate?: string;

  @ApiPropertyOptional({ enum: TaskGeneratedBy })
  @IsOptional()
  @IsEnum(TaskGeneratedBy)
  generatedBy?: TaskGeneratedBy;
}
