import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { Task, TaskStatus } from './task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async create(firmId: string, dto: CreateTaskDto, actorUserId: string): Promise<TaskResponseDto> {
    const assigned = Boolean(dto.assignedToUserId || dto.assignedTeamId);
    const task = this.taskRepository.create({
      ...dto,
      firmId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      status: assigned ? TaskStatus.Assigned : TaskStatus.Unassigned,
      generatedBy: dto.generatedBy,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.taskRepository.save(task));
  }

  async list(firmId: string, query: PaginationQueryDto): Promise<PaginatedResponseDto<TaskResponseDto>> {
    const limit = query.limit ?? 50;
    const where = query.cursor ? { firmId, createdAt: LessThan(new Date(query.cursor)) } : { firmId };
    const tasks = await this.taskRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit + 1,
    });
    const page = tasks.slice(0, limit);
    return {
      data: page.map((task) => this.toResponse(task)),
      nextCursor: tasks.length > limit ? page[page.length - 1]?.createdAt.toISOString() : undefined,
    };
  }

  async getEntityOrFail(firmId: string, id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { firmId, id } });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async updateStatus(firmId: string, id: string, status: TaskStatus, actorUserId: string): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    task.status = status;
    task.startedAt = status === TaskStatus.InProgress && !task.startedAt ? new Date() : task.startedAt;
    task.completedAt = status === TaskStatus.Completed ? new Date() : task.completedAt;
    task.updatedBy = actorUserId;
    return this.toResponse(await this.taskRepository.save(task));
  }

  async assign(
    firmId: string,
    taskId: string,
    assignedToUserId: string | null,
    assignedTeamId: string | null,
    actorUserId: string,
  ): Promise<Task> {
    const task = await this.getEntityOrFail(firmId, taskId);
    task.assignedToUserId = assignedToUserId;
    task.assignedTeamId = assignedTeamId;
    task.status = assignedToUserId || assignedTeamId ? TaskStatus.Assigned : TaskStatus.Unassigned;
    task.updatedBy = actorUserId;
    return this.taskRepository.save(task);
  }

  toResponse(task: Task): TaskResponseDto {
    return {
      id: task.id,
      firmId: task.firmId,
      customerId: task.customerId,
      serviceId: task.serviceId,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
      assignedToUserId: task.assignedToUserId,
      assignedTeamId: task.assignedTeamId,
      dueDate: task.dueDate,
      generatedBy: task.generatedBy,
      workflowId: task.workflowId,
      currentStepId: task.currentStepId,
    };
  }
}
