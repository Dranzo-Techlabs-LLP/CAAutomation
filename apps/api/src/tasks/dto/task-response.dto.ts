import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TaskGeneratedBy, TaskPriority, TaskStatus } from '../task.entity';

export class TaskResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  firmId!: string;

  @ApiProperty()
  customerId!: string;

  @ApiPropertyOptional()
  serviceId?: string | null;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string | null;

  @ApiProperty({ enum: TaskPriority })
  priority!: TaskPriority;

  @ApiProperty({ enum: TaskStatus })
  status!: TaskStatus;

  @ApiPropertyOptional()
  assignedToUserId?: string | null;

  @ApiPropertyOptional()
  assignedTeamId?: string | null;

  @ApiPropertyOptional()
  dueDate?: Date | null;

  @ApiProperty({ enum: TaskGeneratedBy })
  generatedBy!: TaskGeneratedBy;

  @ApiPropertyOptional()
  workflowId?: string | null;

  @ApiPropertyOptional()
  currentStepId?: string | null;
}
