import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServiceCatalog } from '../services-catalog/service-catalog.entity';
import { TasksService } from '../tasks/tasks.service';
import { User } from '../users/user.entity';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { TimeLog } from './time-log.entity';

@Injectable()
export class TimeLogsService {
  constructor(
    @InjectRepository(TimeLog)
    private readonly timeLogRepository: Repository<TimeLog>,
    @InjectRepository(ServiceCatalog)
    private readonly serviceRepository: Repository<ServiceCatalog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
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
}
