import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AuditService } from '../audit/audit.service';
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
    @Optional() @Inject(AuditService) private readonly audit?: AuditService,
  ) {}

  private async writeAudit(action: string, firmId: string, taskId: string, userId: string, before?: Record<string, unknown> | null, after?: Record<string, unknown> | null): Promise<void> {
    if (!this.audit) return;
    try {
      await this.audit.write({
        firmId,
        userId,
        action,
        entityType: 'task',
        entityId: taskId,
        beforeJson: before ?? null,
        afterJson: after ?? null,
        ip: null,
        userAgent: null,
      });
    } catch {
      // Don't fail task ops on audit failure
    }
  }

  private snapshot(t: Task): Record<string, unknown> {
    return {
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      assignedToUserId: t.assignedToUserId ?? null,
      assignedTeamId: t.assignedTeamId ?? null,
      dueDate: t.dueDate?.toISOString() ?? null,
      staffDueDate: t.staffDueDate?.toISOString() ?? null,
      reviewDate: t.reviewDate?.toISOString() ?? null,
      clientDueDate: t.clientDueDate?.toISOString() ?? null,
      resolution: t.resolution ?? null,
      reviewComments: t.reviewComments ?? null,
    };
  }

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
    await this.writeAudit('task.created', firmId, saved.id, actorUserId, null, this.snapshot(saved));

    // Auto-create subtasks from service templates if (a) parent task,
    // (b) linked to a service, and (c) caller did not opt out.
    if (
      saved.serviceId &&
      !saved.parentTaskId &&
      saved.generatedBy !== TaskGeneratedBy.Recurrence
    ) {
      await this.materializeSubtasksFromTemplates(firmId, saved, actorUserId);
    }
    return this.toResponse(saved);
  }

  async list(
    firmId: string,
    query: PaginationQueryDto,
    opts: { restrictToUserId?: string | null } = {},
  ): Promise<PaginatedResponseDto<TaskResponseDto>> {
    const limit = query.limit ?? 50;
    // Hide subtasks from main list by default — they live under their parent.
    // When restrictToUserId is set, only return tasks assigned to that user.
    const baseWhere: Record<string, unknown> = { firmId, parentTaskId: IsNull() };
    if (opts.restrictToUserId) {
      baseWhere.assignedToUserId = opts.restrictToUserId;
    }
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
    const before = this.snapshot(task);
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
    if (dto.reviewComments !== undefined) task.reviewComments = dto.reviewComments;
    if (dto.hourlyRate !== undefined) task.hourlyRate = dto.hourlyRate || null;
    task.updatedBy = actorUserId;
    const saved = await this.taskRepository.save(task);
    await this.writeAudit('task.updated', firmId, saved.id, actorUserId, before, this.snapshot(saved));
    return this.toResponse(saved);
  }

  async delete(firmId: string, id: string, actorUserId: string): Promise<void> {
    const task = await this.getEntityOrFail(firmId, id);
    const before = this.snapshot(task);
    await this.taskRepository.delete({ firmId, parentTaskId: id });
    await this.taskRepository.remove(task);
    await this.writeAudit('task.deleted', firmId, id, actorUserId, before, null);
  }

  async updateStatus(firmId: string, id: string, status: string, actorUserId: string): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    const prev = task.status;
    task.status = status as TaskStatus;
    if (status === TaskStatus.InProgress && !task.startedAt) task.startedAt = new Date();
    if (status === TaskStatus.Completed) task.completedAt = new Date();
    task.updatedBy = actorUserId;
    const saved = await this.taskRepository.save(task);
    await this.writeAudit('task.status_changed', firmId, saved.id, actorUserId, { status: prev }, { status: saved.status });
    return this.toResponse(saved);
  }

  async updateResolution(
    firmId: string,
    id: string,
    dto: UpdateTaskResolutionDto,
    actorUserId: string,
  ): Promise<TaskResponseDto> {
    const task = await this.getEntityOrFail(firmId, id);
    const before = this.snapshot(task);
    task.resolution = dto.resolution;
    if (dto.status) {
      task.status = dto.status as TaskStatus;
      task.completedAt = dto.status === TaskStatus.Completed ? new Date() : task.completedAt;
    }
    task.updatedBy = actorUserId;
    const saved = await this.taskRepository.save(task);
    await this.writeAudit('task.resolution_added', firmId, saved.id, actorUserId, before, this.snapshot(saved));
    return this.toResponse(saved);
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
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return subs.map((t) => this.toResponse(t));
  }

  async reorderSubtasks(firmId: string, parentId: string, orderedIds: string[], actorUserId: string): Promise<TaskResponseDto[]> {
    await this.getEntityOrFail(firmId, parentId);
    const subs = await this.taskRepository.find({
      where: { firmId, parentTaskId: parentId },
    });
    const byId = new Map(subs.map((s) => [s.id, s]));
    // Refuse if the payload references any subtask that doesn't belong to
    // this parent — prevents silent no-ops that hide permission errors.
    const foreign = orderedIds.find((id) => !byId.has(id));
    if (foreign) {
      throw new NotFoundException(`Subtask ${foreign} does not belong to parent ${parentId}`);
    }
    const updates: Task[] = [];
    orderedIds.forEach((id, idx) => {
      const sub = byId.get(id)!;
      sub.sortOrder = idx;
      sub.updatedBy = actorUserId;
      updates.push(sub);
    });
    if (updates.length) await this.taskRepository.save(updates);
    await this.writeAudit(
      'subtask.reordered',
      firmId,
      parentId,
      actorUserId,
      null,
      { orderedIds },
    );
    return this.listSubtasks(firmId, parentId);
  }

  async createSubtask(
    firmId: string,
    parentId: string,
    body: {
      title: string;
      description?: string;
      priority?: TaskPriority;
      estimatedHours?: string;
      assignedToUserId?: string | null;
      assignedTeamId?: string | null;
      dueDate?: string;
      staffDueDate?: string;
      reviewDate?: string;
      clientDueDate?: string;
      reviewComments?: string;
      hourlyRate?: string;
      billable?: boolean;
    },
    actorUserId: string,
  ): Promise<TaskResponseDto> {
    const parent = await this.getEntityOrFail(firmId, parentId);
    // Default assignee falls back to parent's assignee when caller does not specify.
    const resolvedAssignee =
      body.assignedToUserId !== undefined ? body.assignedToUserId : parent.assignedToUserId ?? null;
    const resolvedTeam =
      body.assignedTeamId !== undefined ? body.assignedTeamId : parent.assignedTeamId ?? null;
    const isAssigned = Boolean(resolvedAssignee || resolvedTeam);
    // Append to the bottom of the subtask list.
    const maxOrder = await this.taskRepository
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.sort_order), -1)', 'max')
      .where('t.firm_id = :firmId AND t.parent_task_id = :parentId', { firmId, parentId })
      .getRawOne<{ max: number }>();
    const nextOrder = (maxOrder?.max ?? -1) + 1;
    const sub = this.taskRepository.create({
      sortOrder: nextOrder,
      firmId,
      customerId: parent.customerId,
      serviceId: parent.serviceId,
      parentTaskId: parent.id,
      title: body.title,
      description: body.description ?? null,
      reviewComments: body.reviewComments ?? null,
      priority: body.priority ?? parent.priority,
      status: isAssigned ? TaskStatus.Assigned : TaskStatus.Unassigned,
      assignedToUserId: resolvedAssignee,
      assignedTeamId: resolvedTeam,
      dueDate: body.dueDate ? new Date(body.dueDate) : parent.dueDate ?? null,
      staffDueDate: body.staffDueDate ? new Date(body.staffDueDate) : null,
      reviewDate: body.reviewDate ? new Date(body.reviewDate) : null,
      clientDueDate: body.clientDueDate ? new Date(body.clientDueDate) : null,
      estimatedHours: body.estimatedHours ?? null,
      hourlyRate: body.hourlyRate ?? null,
      billable: body.billable ?? parent.billable,
      generatedBy: TaskGeneratedBy.Manual,
      createdBy: actorUserId,
      updatedBy: actorUserId,
    });
    const saved = await this.taskRepository.save(sub);
    await this.writeAudit('task.created', firmId, saved.id, actorUserId, null, this.snapshot(saved));
    return this.toResponse(saved);
  }

  private async materializeSubtasksFromTemplates(firmId: string, parent: Task, actorUserId: string): Promise<void> {
    if (!parent.serviceId) return;
    const templates = await this.templateRepository.find({
      where: { firmId, serviceId: parent.serviceId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    if (!templates.length) return;
    const inheritedAssignee = parent.assignedToUserId ?? null;
    const inheritedTeam = parent.assignedTeamId ?? null;
    const isAssigned = Boolean(inheritedAssignee || inheritedTeam);
    const subs = templates.map((t, idx) =>
      this.taskRepository.create({
        firmId,
        customerId: parent.customerId,
        serviceId: parent.serviceId,
        parentTaskId: parent.id,
        title: t.title,
        description: t.description ?? null,
        priority: t.priority,
        status: isAssigned ? TaskStatus.Assigned : TaskStatus.Unassigned,
        assignedToUserId: inheritedAssignee,
        assignedTeamId: inheritedTeam,
        dueDate: parent.dueDate ?? null,
        estimatedHours: t.estimatedHours ?? null,
        billable: parent.billable,
        sortOrder: t.sortOrder ?? idx,
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
      reviewComments: task.reviewComments,
      sortOrder: task.sortOrder ?? 0,
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
