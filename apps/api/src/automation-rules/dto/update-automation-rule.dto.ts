import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { RuleAction, RuleCondition, RuleEvent } from '../automation-rule.entity';

export class UpdateAutomationRuleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  events?: RuleEvent[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  conditions?: RuleCondition[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  actions?: RuleAction[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;
}
