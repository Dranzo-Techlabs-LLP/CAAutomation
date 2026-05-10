import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatus } from '../task.entity';

export class UpdateTaskResolutionDto {
  @ApiProperty()
  @IsString()
  resolution!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(60)
  status?: TaskStatus | string;
}
