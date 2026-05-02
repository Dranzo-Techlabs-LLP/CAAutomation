import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from '../notifications/notification.entity';
import { Task, TaskPriority, TaskStatus } from '../tasks/task.entity';
import { WorkflowsService } from '../workflows/workflows.service';
import { ActionType } from './automation-rule.entity';
import { ResolvedAction } from './automation-rules.service';

@Injectable()
export class ActionExecutorService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly workflowsService: WorkflowsService,
  ) {}

  async executeActions(task: Task, actions: ResolvedAction[], actorUserId: string): Promise<void> {
    for (const action of actions) {
      await this.executeOne(task, action, actorUserId);
    }
  }

  private async executeOne(task: Task, action: ResolvedAction, actorUserId: string): Promise<void> {
    switch (action.type) {
      case ActionType.SetStatus:
        if (Object.values(TaskStatus).includes(action.value as TaskStatus)) {
          task.status = action.value as TaskStatus;
          if (task.status === TaskStatus.Completed) task.completedAt = new Date();
          if (task.status === TaskStatus.InProgress && !task.startedAt) task.startedAt = new Date();
          task.updatedBy = actorUserId;
          await this.taskRepository.save(task);
        }
        break;

      case ActionType.SetPriority:
        if (Object.values(TaskPriority).includes(action.value as TaskPriority)) {
          task.priority = action.value as TaskPriority;
          task.updatedBy = actorUserId;
          await this.taskRepository.save(task);
        }
        break;

      case ActionType.AssignToUser:
        task.assignedToUserId = action.value;
        if (task.status === TaskStatus.Unassigned) task.status = TaskStatus.Assigned;
        task.updatedBy = actorUserId;
        await this.taskRepository.save(task);
        break;

      case ActionType.AssignToTeam:
        task.assignedTeamId = action.value;
        task.updatedBy = actorUserId;
        await this.taskRepository.save(task);
        break;

      case ActionType.SetResolution:
        task.resolution = action.value;
        task.updatedBy = actorUserId;
        await this.taskRepository.save(task);
        break;

      case ActionType.StartWorkflow:
        try {
          await this.workflowsService.startTaskWorkflow(task.firmId, task.id, action.value, actorUserId);
        } catch {
          // workflow may already be started or not found
        }
        break;

      case ActionType.CreateNotification:
        if (task.assignedToUserId) {
          await this.notificationRepository.save(
            this.notificationRepository.create({
              firmId: task.firmId,
              userId: task.assignedToUserId,
              type: 'automation_rule',
              payloadJson: {
                title: 'Automation Rule Triggered',
                message: action.value || `Rule triggered on task: ${task.title}`,
                taskId: task.id,
              },
            }),
          );
        }
        break;
    }
  }
}
