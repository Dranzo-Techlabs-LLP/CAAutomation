import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { ServiceSubtaskTemplate } from '../services-catalog/service-subtask-template.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateTaskResolutionDto } from './dto/update-task-resolution.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { Task, TaskGeneratedBy, TaskPriority, TaskStatus } from './task.entity';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(ServiceSubtaskTemplate)
    private readonly templateRepository: Repository<ServiceSubtaskTemplate>,
  ) {}

  async create(firmId: string, dto: CreateTaskDto, actorUserId: string): Promise<TaskResponseDto> {
    const assigned = Boolean(dto.assignedToUserId || dto.assignedTeamId);
    const task = this.taskRepository.create({
      ...dto,
      firmId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      staffDueDate: dto.staffDueDate ? new Date(dto.staffDueDate) : null,
      reviewDate: dto.reviewDate ? new Date(dto.reviewDate) : null,
      clientDueDate: dto.clientDueDate ? new Date(dto.clientDueDate) : null,
      status: assigned ? TaskStatus.Assigned : TaskStatus.Unassigned,
      generatedBy: dto.generatedBy,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    const saved = await this.taskRepository.save(task);

    // Auto-create subtasks from service templates if (a) parent task,
    // (b) linked to a service, and (c) caller did not opt out.
    // Subtask creation is skipped automatically if the task itself is a subtask
    // (parentTaskId set) to avoid recursive creation, and when the source is
    // recurrence/workflow which manage their own children.
    if (
      saved.serviceId &&
      !saved.parentTaskId &&
      saved.generatedBy !== TaskGeneratedBy.Recurrence
    ) {
      await this.materializeSubtasksFromTemplates(firmId, saved, actorUserId);
    }
    return this.toResponse(saved);
  }

  async list(firmId: string, query: PaginationQueryDto): Promise<PaginatedResponseDto<TaskResponseDto>> {
    const limit = query.limit ?? 50;
    // Hide subtasks from main list by default — they live under their parent
    const baseWhere = { firmId, parentTaskId: IsNull() };
    const where = query.cursor
      ? { ...baseWhere, createdAt: LessThan(new Date(query.cursor)) }
      : baseWhere;
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
    if (dto.staffDueDate !== undefined) task.staffDueDate = dto.staffDueDate ? new Date(dto.staffDueDate) : null;
    if (dto.reviewDate !== undefined) task.reviewDate = dto.reviewDate ? new Date(dto.reviewDate) : null;
    if (dto.clientDueDate !== undefined) task.clientDueDate = dto.clientDueDate ? new Date(dto.clientDueDate) : null;
    if (dto.resolution !== undefined) task.resolution = dto.resolution;
    task.updatedBy = actorUserId;
    return this.toResponse(await this.taskRepository.save(task));
  }

  async delete(firmId: string, id: string): Promise<void> {
    const task = await this.getEntityOrFail(firmId, id);
    // Cascade-delete subtasks when removing parent
    await this.taskRepository.delete({ firmId, parentTaskId: id });
    await this.taskRepository.remove(task);
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

  // ── Subtasks ──────────────────────────────────────────────────────────────

  async listSubtasks(firmId: string, parentId: string): Promise<TaskResponseDto[]> {
    await this.getEntityOrFail(firmId, parentId);
    const subs = await this.taskRepository.find({
      where: { firmId, parentTaskId: parentId },
      order: { createdAt: 'ASC' },
    });
    return subs.map((t) => this.toResponse(t));
  }

  async createSubtask(
    firmId: string,
    parentId: string,
    body: { title: string; description?: string; priority?: TaskPriority; estimatedHours?: string; assignedToUserId?: string; dueDate?: string },
    actorUserId: string,
  ): Promise<TaskResponseDto> {
    const parent = await this.getEntityOrFail(firmId, parentId);
    const assigned = Boolean(body.assignedToUserId);
    const sub = this.taskRepository.create({
      firmId,
      customerId: parent.customerId,
      serviceId: parent.serviceId,
      parentTaskId: parent.id,
      title: body.title,
      description: body.description ?? null,
      priority: body.priority ?? parent.priority,
      status: assigned ? TaskStatus.Assigned : TaskStatus.Unassigned,
      assignedToUserId: body.assignedToUserId ?? null,
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      estimatedHours: body.estimatedHours ?? null,
      generatedBy: TaskGeneratedBy.Manual,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    return this.toResponse(await this.taskRepository.save(sub));
  }

  private async materializeSubtasksFromTemplates(firmId: string, parent: Task, actorUserId: string): Promise<void> {
    if (!parent.serviceId) return;
    const templates = await this.templateRepository.find({
      where: { firmId, serviceId: parent.serviceId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (!templates.length) return;
    const subs = templates.map((t) =>
      this.taskRepository.create({
        firmId,
        customerId: parent.customerId,
        serviceId: parent.serviceId,
        parentTaskId: parent.id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        status: TaskStatus.Unassigned,
        estimatedHours: t.estimatedHours ?? null,
        generatedBy: TaskGeneratedBy.Manual,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
    await this.taskRepository.save(subs);
  }

  toResponse(task: Task): TaskResponseDto {
    return {
      id: task.id,
      firmId: task.firmId,
      customerId: task.customerId,
      serviceId: task.serviceId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      description: task.description,
      resolution: task.resolution,
      priority: task.priority,
      status: task.status,
      assignedToUserId: task.assignedToUserId,
      assignedTeamId: task.assignedTeamId,
      dueDate: task.dueDate,
      staffDueDate: task.staffDueDate,
      reviewDate: task.reviewDate,
      clientDueDate: task.clientDueDate,
      generatedBy: task.generatedBy,
      workflowId: task.workflowId,
      currentStepId: task.currentStepId,
    };
  }
}
