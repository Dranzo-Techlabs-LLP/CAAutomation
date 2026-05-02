import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { RuleEventType } from './automation-rule.entity';
import { ActionExecutorService } from './action-executor.service';
import { AutomationRulesService } from './automation-rules.service';

@Injectable()
export class TaskLifecycleService {
  constructor(
    private readonly automationRulesService: AutomationRulesService,
    private readonly actionExecutorService: ActionExecutorService,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async onTaskCreated(taskId: string, firmId: string, actorUserId: string): Promise<void> {
    await this.processEvent(taskId, firmId, RuleEventType.Created, actorUserId);
  }

  async onTaskStatusChanged(taskId: string, firmId: string, actorUserId: string): Promise<void> {
    await this.processEvent(taskId, firmId, RuleEventType.StatusChanged, actorUserId);
  }

  async onTaskAssigned(taskId: string, firmId: string, actorUserId: string): Promise<void> {
    await this.processEvent(taskId, firmId, RuleEventType.Assigned, actorUserId);
  }

  async onTaskResolutionAdded(taskId: string, firmId: string, actorUserId: string): Promise<void> {
    await this.processEvent(taskId, firmId, RuleEventType.ResolutionAdded, actorUserId);
  }

  async onTaskUpdated(taskId: string, firmId: string, actorUserId: string): Promise<void> {
    await this.processEvent(taskId, firmId, RuleEventType.Updated, actorUserId);
  }

  private async processEvent(taskId: string, firmId: string, eventType: RuleEventType, actorUserId: string): Promise<void> {
    try {
      const task = await this.taskRepository.findOne({ where: { id: taskId, firmId } });
      if (!task) return;

      const actions = await this.automationRulesService.evaluateTaskEvent({
        firmId,
        task,
        eventType,
        actorUserId,
      });

      if (actions.length > 0) {
        await this.actionExecutorService.executeActions(task, actions, actorUserId);
      }
    } catch {
      // automation rules should never break the main flow
    }
  }
}
