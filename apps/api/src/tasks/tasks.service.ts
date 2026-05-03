import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskResolutionDto } from './dto/update-task-resolution.dto';
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

  async listAssignedToUser(
    firmId: string,
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TaskResponseDto>> {
    const limit = query.limit ?? 50;
    const where = query.cursor
      ? { firmId, assignedToUserId: userId, createdAt: LessThan(new Date(query.cursor)) }
      : { firmId, assignedToUserId: userId };
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

  async update(firmId: string, id: string, dto: UpdateTaskDto, actorUserId: string): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    if (dto.title !== undefined) task.title = dto.title;
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.assignedToUserId !== undefined) task.assignedToUserId = dto.assignedToUserId;
    if (dto.assignedTeamId !== undefined) task.assignedTeamId = dto.assignedTeamId;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.resolution !== undefined) task.resolution = dto.resolution;
    task.updatedBy = actorUserId;
    return this.toResponse(await this.taskRepository.save(task));
  }

  async updateStatus(firmId: string, id: string, status: TaskStatus, actorUserId: string): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    task.status = status;
    task.startedAt = status === TaskStatus.InProgress && !task.startedAt ? new Date() : task.startedAt;
    task.completedAt = status === TaskStatus.Completed ? new Date() : task.completedAt;
    task.updatedBy = actorUserId;
    return this.toResponse(await this.taskRepository.save(task));
  }

  async updateResolution(
    firmId: string,
    id: string,
    dto: UpdateTaskResolutionDto,
    actorUserId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    task.resolution = dto.resolution;
    if (dto.status) {
      task.status = dto.status;
      task.completedAt = dto.status === TaskStatus.Completed ? new Date() : task.completedAt;
    }
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
      resolution: task.resolution,
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
