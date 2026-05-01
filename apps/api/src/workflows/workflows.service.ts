import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskStatus } from '../tasks/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { CompleteStepDto } from './dto/complete-step.dto';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { TaskStepHistory, TaskStepHistoryStatus } from './task-step-history.entity';
import { OnCompleteAction, WorkflowStep } from './workflow-step.entity';
import { Workflow } from './workflow.entity';

@Injectable()
export class WorkflowsService {
  constructor(
    @InjectRepository(Workflow)
    private readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowStep)
    private readonly stepRepository: Repository<WorkflowStep>,
    @InjectRepository(TaskStepHistory)
    private readonly historyRepository: Repository<TaskStepHistory>,
    private readonly tasksService: TasksService,
  ) {}

  async create(firmId: string, dto: CreateWorkflowDto, actorUserId: string): Promise<Workflow> {
    const version = await this.nextVersion(firmId, dto.name);
    const workflow = await this.workflowRepository.save(
      this.workflowRepository.create({
        firmId,
        name: dto.name,
        description: dto.description,
        appliesTo: dto.appliesTo ?? 'any',
        version,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );

    await this.stepRepository.save(
      dto.steps.map((step) =>
        this.stepRepository.create({
          workflowId: workflow.id,
          sequenceNo: step.sequenceNo,
          name: step.name,
          assigneeStrategy: step.assigneeStrategy,
          assigneeValue: step.assigneeValue,
          slaHours: step.slaHours,
          requiresAttachment: step.requiresAttachment ?? false,
          requiresApproval: step.requiresApproval ?? false,
          approverRoleId: step.approverRoleId,
          onCompleteAction: step.onCompleteAction ?? OnCompleteAction.NextStep,
          createdBy: actorUserId,
          updatedBy: actorUserId,
        }),
      ),
    );

    return workflow;
  }

  async list(firmId: string): Promise<Workflow[]> {
    return this.workflowRepository.find({ where: { firmId }, order: { name: 'ASC', version: 'DESC' } });
  }

  async steps(workflowId: string): Promise<WorkflowStep[]> {
    return this.stepRepository.find({ where: { workflowId }, order: { sequenceNo: 'ASC' } });
  }

  async startTaskWorkflow(firmId: string, taskId: string, workflowId: string, actorUserId: string): Promise<void> {
    const task = await this.tasksService.getEntityOrFail(firmId, taskId);
    const firstStep = await this.stepRepository.findOne({ where: { workflowId }, order: { sequenceNo: 'ASC' } });
    if (!firstStep) {
      throw new BadRequestException('Workflow has no steps');
    }

    task.workflowId = workflowId;
    task.currentStepId = firstStep.id;
    task.updatedBy = actorUserId;
    await this.historyRepository.manager.save(task);
    await this.historyRepository.save(
      this.historyRepository.create({
        firmId,
        taskId,
        stepId: firstStep.id,
        status: TaskStepHistoryStatus.Started,
        startedAt: new Date(),
      }),
    );
  }

  async completeCurrentStep(
    firmId: string,
    taskId: string,
    dto: CompleteStepDto,
    actorUserId: string,
  ): Promise<{ taskId: string; completedStepId: string; nextStepId?: string; status: TaskStatus }> {
    const task = await this.tasksService.getEntityOrFail(firmId, taskId);
    if (!task.workflowId || !task.currentStepId) {
      throw new BadRequestException('Task is not attached to an active workflow step');
    }

    const currentStep = await this.stepRepository.findOne({ where: { id: task.currentStepId } });
    if (!currentStep) {
      throw new NotFoundException('Current workflow step not found');
    }
    if (currentStep.requiresAttachment && !dto.attachmentsCount) {
      throw new BadRequestException('This workflow step requires an attachment');
    }

    await this.historyRepository.save(
      this.historyRepository.create({
        firmId,
        taskId,
        stepId: currentStep.id,
        status: TaskStepHistoryStatus.Completed,
        completedAt: new Date(),
        completedByUserId: actorUserId,
        notes: dto.notes,
        attachmentsCount: dto.attachmentsCount ?? 0,
      }),
    );

    const nextStep =
      currentStep.onCompleteAction === OnCompleteAction.End
        ? null
        : await this.stepRepository.findOne({
            where: { workflowId: task.workflowId, sequenceNo: currentStep.sequenceNo + 1 },
          });

    task.currentStepId = nextStep?.id ?? null;
    task.status = nextStep ? TaskStatus.InProgress : TaskStatus.Completed;
    task.completedAt = nextStep ? task.completedAt : new Date();
    task.updatedBy = actorUserId;
    await this.historyRepository.manager.save(task);

    if (nextStep) {
      await this.historyRepository.save(
        this.historyRepository.create({
          firmId,
          taskId,
          stepId: nextStep.id,
          status: TaskStepHistoryStatus.Started,
          startedAt: new Date(),
        }),
      );
    }

    return {
      taskId,
      completedStepId: currentStep.id,
      nextStepId: nextStep?.id,
      status: task.status,
    };
  }

  private async nextVersion(firmId: string, name: string): Promise<number> {
    const latest = await this.workflowRepository.findOne({
      where: { firmId, name },
      order: { version: 'DESC' },
    });
    return latest ? latest.version + 1 : 1;
  }
}
