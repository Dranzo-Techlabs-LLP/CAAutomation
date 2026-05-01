import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { OnCompleteAction, StepAssigneeStrategy } from '../workflow-step.entity';

export class CreateWorkflowStepDto {
  @ApiProperty()
  @IsInt()
  @Min(1)
  sequenceNo!: number;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ enum: StepAssigneeStrategy })
  @IsEnum(StepAssigneeStrategy)
  assigneeStrategy!: StepAssigneeStrategy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  assigneeValue?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  slaHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresAttachment?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  requiresApproval?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  approverRoleId?: string;

  @ApiPropertyOptional({ enum: OnCompleteAction })
  @IsOptional()
  @IsEnum(OnCompleteAction)
  onCompleteAction?: OnCompleteAction;
}

export class CreateWorkflowDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appliesTo?: string;

  @ApiProperty({ type: [CreateWorkflowStepDto] })
  @ValidateNested({ each: true })
  @Type(() => CreateWorkflowStepDto)
  steps!: CreateWorkflowStepDto[];
}
