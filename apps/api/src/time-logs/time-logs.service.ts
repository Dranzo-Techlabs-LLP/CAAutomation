import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TasksService } from '../tasks/tasks.service';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { TimeLog } from './time-log.entity';

@Injectable()
export class TimeLogsService {
  constructor(
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
    private readonly tasksService: TasksService,
  ) {}

  async create(firmId: string, dto: CreateTimeLogDto, actorUserId: string): Promise<TimeLog> {
    await this.tasksService.getEntityOrFail(firmId, dto.taskId);
    const startedAt = new Date(dto.startedAt);
    const endedAt = dto.endedAt ? new Date(dto.endedAt) : null;
    if (endedAt && endedAt < startedAt) {
      throw new BadRequestException('endedAt must be after startedAt');
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
        hourlyRate: dto.hourlyRate,
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
}
