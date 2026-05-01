import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CompleteStepDto } from './dto/complete-step.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { WorkflowStep } from './workflow-step.entity';
import { Workflow } from './workflow.entity';
import { WorkflowsService } from './workflows.service';

@ApiTags('Workflows')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get()
  @Permissions('workflow.view')
  async list(@CurrentUser() user: RequestUser): Promise<Workflow[]> {
    return this.workflowsService.list(user.firmId);
  }

  @Post()
  @Permissions('workflow.manage')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateWorkflowDto): Promise<Workflow> {
    return this.workflowsService.create(user.firmId, dto, user.id);
  }

  @Get(':id/steps')
  @Permissions('workflow.view')
  async steps(@Param('id') id: string): Promise<WorkflowStep[]> {
    return this.workflowsService.steps(id);
  }

  @Post('tasks/:taskId/start/:workflowId')
  @Permissions('workflow.manage')
  async startTaskWorkflow(
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Param('workflowId') workflowId: string,
  ): Promise<{ message: string }> {
    await this.workflowsService.startTaskWorkflow(user.firmId, taskId, workflowId, user.id);
    return { message: 'Workflow started for task' };
  }

  @Post('tasks/:taskId/complete-step')
  @Permissions('task.edit')
  async completeStep(
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() dto: CompleteStepDto,
  ): Promise<{ taskId: string; completedStepId: string; nextStepId?: string; status: string }> {
    return this.workflowsService.completeCurrentStep(user.firmId, taskId, dto, user.id);
  }
}
