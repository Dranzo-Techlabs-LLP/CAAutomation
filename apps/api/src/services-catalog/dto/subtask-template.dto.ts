import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsNumberString, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { TaskPriority } from '../../tasks/task.entity';

// Empty strings from optional form inputs should map to undefined so they
// skip strict validators like IsNumberString / IsEmail / IsUUID.
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreateSubtaskTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(220)
  title!: string;

  @ApiPropertyOptional()
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: 0 })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Decimal hours, e.g. "1.50"' })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsNumberString()
  estimatedHours?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @Transform(emptyToUndefined)
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}

// Update: every field optional (including title) so callers can patch any subset.
export class UpdateSubtaskTemplateDto extends PartialType(CreateSubtaskTemplateDto) {}

export class ReorderSubtaskTemplatesDto {
  @ApiProperty({ description: 'Array of template IDs in desired order' })
  @IsString({ each: true })
  ids!: string[];
}
