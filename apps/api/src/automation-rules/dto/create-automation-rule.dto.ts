import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { RuleAction, RuleCondition, RuleEvent } from '../automation-rule.entity';

export class CreateAutomationRuleDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty()
  @IsArray()
  events!: RuleEvent[];

  @ApiProperty()
  @IsArray()
  conditions!: RuleCondition[];

  @ApiProperty()
  @IsArray()
  actions!: RuleAction[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
