import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { Task } from '../tasks/task.entity';
import { TasksService } from '../tasks/tasks.service';
import { User } from '../users/user.entity';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { TimeLog } from './time-log.entity';

export interface TaskTimeRollup {
  totalMinutes: number;
  billableMinutes: number;
  byAssignee: { userId: string | null; userName: string | null; minutes: number; billableMinutes: number; entries: number }[];
  byTask: { taskId: string; title: string; isParent: boolean; minutes: number; entries: number }[];
  entries: (TimeLog & { taskTitle?: string; userName?: string | null })[];
}

@Injectable()
export class TimeLogsService {
  constructor(
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    private readonly tasksService: TasksService,
  ) {}

  async create(firmId: string, dto: CreateTimeLogDto, actorUserId: string): Promise<TimeLog> {
    const task = await this.tasksService.getEntityOrFail(firmId, dto.taskId);
    const startedAt = new Date(dto.startedAt);
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;
    if (endedAt && endedAt < startedAt) {
      throw new BadRequestException('endedAt must be after startedAt');
    }

    // Resolve hourly rate: explicit > task.hourlyRate > service.defaultHourlyRate > user.defaultHourlyRate
    let hourlyRate: string | null = dto.hourlyRate ?? null;
    if (!hourlyRate && task.hourlyRate) hourlyRate = task.hourlyRate;
    if (!hourlyRate && task.serviceId) {
      const svc = await this.serviceRepository.findOne({ where: { firmId, id: task.serviceId } });
      if (svc?.defaultHourlyRate) hourlyRate = svc.defaultHourlyRate;
    }
    if (!hourlyRate) {
      const user = await this.userRepository.findOne({ where: { id: actorUserId } });
      if (user?.defaultHourlyRate) hourlyRate = user.defaultHourlyRate;
    }

    return this.timeLogRepository.save(
      this.timeLogRepository.create({
        firmId,
        taskId: dto.taskId,
        userId: actorUserId,
        startedAt,
        endedAt,
        durationMinutes: endedAt ? Math.ceil((endedAt.getTime() - startedAt.getTime()) / 60_000) : null,
        isBillable: dto.isBillable ?? true,
        hourlyRate,
        notes: dto.notes,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async listForTask(firmId: string, taskId: string): Promise<TimeLog[]> {
    await this.tasksService.getEntityOrFail(firmId, taskId);
    return this.timeLogRepository.find({ where: { firmId, taskId }, order: { startedAt: 'DESC' } });
  }

  /**
   * Correct a time-log entry (e.g. accidental double-save logged 2h for 1h of
   * work). Only the person who logged it may change it, unless the actor has
   * task.edit (supervisor correcting staff entries).
   */
  async update(
    firmId: string,
    id: string,
    dto: UpdateTimeLogDto,
    actorUserId: string,
    canManageOthers: boolean,
  ): Promise<TimeLog> {
    const log = await this.timeLogRepository.findOne({ where: { firmId, id } });
    if (!log) throw new NotFoundException('Time log not found');
    if (log.userId !== actorUserId && !canManageOthers) {
      throw new ForbiddenException('Only the person who logged this time (or a task editor) can change it');
    }
    if (dto.durationMinutes !== undefined) {
      log.durationMinutes = dto.durationMinutes;
      log.endedAt = new Date(new Date(log.startedAt).getTime() + dto.durationMinutes * 60_000);
    }
    if (dto.notes !== undefined) log.notes = dto.notes;
    if (dto.isBillable !== undefined) log.isBillable = dto.isBillable;
    log.updatedBy = actorUserId;
    return this.timeLogRepository.save(log);
  }

  /** Delete a wrong entry outright (same ownership rule as update). */
  async remove(
    firmId: string,
    id: string,
    actorUserId: string,
    canManageOthers: boolean,
  ): Promise<{ deleted: true }> {
    const log = await this.timeLogRepository.findOne({ where: { firmId, id } });
    if (!log) throw new NotFoundException('Time log not found');
    if (log.userId !== actorUserId && !canManageOthers) {
      throw new ForbiddenException('Only the person who logged this time (or a task editor) can delete it');
    }
    await this.timeLogRepository.remove(log);
    return { deleted: true };
  }

  /**
   * Returns time logs for a parent task plus every subtask, grouped by
   * assignee and by task. Used by the task drawer's Efforts roll-up.
   */
  async rollupForTask(firmId: string, taskId: string): Promise<TaskTimeRollup> {
    const parent = await this.tasksService.getEntityOrFail(firmId, taskId);
    const subs = await this.taskRepository.find({
      where: { firmId, parentTaskId: taskId },
      select: ['id', 'title', 'sortOrder'],
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const taskIds = [parent.id, ...subs.map((s) => s.id)];
    // Position 0 = parent, 1..N = subtasks in displayed order.
    const taskOrderById = new Map<string, number>([
      [parent.id, 0],
      ...subs.map((s, idx) => [s.id, idx + 1] as [string, number]),
    ]);
    const taskTitleById = new Map<string, string>([
      [parent.id, parent.title],
      ...subs.map((s) => [s.id, s.title] as [string, string]),
    ]);
    const logs = taskIds.length
      ? await this.timeLogRepository.find({
          where: { firmId, taskId: In(taskIds) },
          order: { startedAt: 'DESC' },
        })
      : [];
    const userIds = Array.from(new Set(logs.map((l) => l.userId).filter(Boolean)));
    const users = userIds.length
      ? await this.userRepository.find({ where: { firmId, id: In(userIds) }, select: ['id', 'name'] })
      : [];
    const userNameById = new Map(users.map((u) => [u.id, u.name]));

    // Group by assignee
    const byAssigneeMap = new Map<string, { userId: string | null; userName: string | null; minutes: number; billableMinutes: number; entries: number }>();
    for (const l of logs) {
      const key = l.userId ?? '__null';
      let row = byAssigneeMap.get(key);
      if (!row) {
        row = {
          userId: l.userId ?? null,
          userName: l.userId ? userNameById.get(l.userId) ?? null : null,
          minutes: 0,
          billableMinutes: 0,
          entries: 0,
        };
        byAssigneeMap.set(key, row);
      }
      const mins = l.durationMinutes ?? 0;
      row.minutes += mins;
      if (l.isBillable) row.billableMinutes += mins;
      row.entries += 1;
    }

    // Group by task (parent vs each subtask)
    const byTaskMap = new Map<string, { taskId: string; title: string; isParent: boolean; minutes: number; entries: number }>();
    for (const tid of taskIds) {
      byTaskMap.set(tid, {
        taskId: tid,
        title: taskTitleById.get(tid) ?? '',
        isParent: tid === parent.id,
        minutes: 0,
        entries: 0,
      });
    }
    let total = 0;
    let billable = 0;
    for (const l of logs) {
      const mins = l.durationMinutes ?? 0;
      total += mins;
      if (l.isBillable) billable += mins;
      const tRow = byTaskMap.get(l.taskId);
      if (tRow) {
        tRow.minutes += mins;
        tRow.entries += 1;
      }
    }

    // Sort entries by task position first (parent → subtask 1 → 2 → ...),
    // then by most recent within each task so the order in the Efforts list
    // matches the subtask order shown in the Subtasks tab.
    const orderedEntries = logs
      .map((l) => ({
        ...l,
        taskTitle: taskTitleById.get(l.taskId) ?? '',
        userName: l.userId ? userNameById.get(l.userId) ?? null : null,
        _order: taskOrderById.get(l.taskId) ?? 999,
      }))
      .sort((a, b) => {
        if (a._order !== b._order) return a._order - b._order;
        return new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime();
      })
      .map(({ _order, ...rest }) => rest);

    // byTask: parent first, then subtasks in their displayed sort order.
    const orderedByTask = Array.from(byTaskMap.values()).sort((a, b) => {
      const oa = taskOrderById.get(a.taskId) ?? 999;
      const ob = taskOrderById.get(b.taskId) ?? 999;
      return oa - ob;
    });

    return {
      totalMinutes: total,
      billableMinutes: billable,
      byAssignee: Array.from(byAssigneeMap.values()).sort((a, b) => b.minutes - a.minutes),
      byTask: orderedByTask,
      entries: orderedEntries,
    };
  }
}
