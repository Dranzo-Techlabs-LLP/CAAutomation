import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TaskPriority } from '../../tasks/task.entity';

export class CreateSubtaskTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Decimal hours, e.g. "1.50"' })
  @IsOptional()
  @IsNumberString()
  estimatedHours?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}

export class UpdateSubtaskTemplateDto extends CreateSubtaskTemplateDto {}

export class ReorderSubtaskTemplatesDto {
  @ApiProperty({ description: 'Array of template IDs in desired order' })
  @IsString({ each: true })
  ids!: string[];
}
