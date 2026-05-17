import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
  ) {}

  async write(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    return this.auditRepository.save(this.auditRepository.create(entry));
  }

  async list(firmId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({ where: { firmId }, order: { createdAt: 'DESC' }, take: 200 });
  }

  async listForEntity(firmId: string, entityType: string, entityId: string, limit = 200): Promise<AuditLog[]> {
    // For tasks, also surface audit entries from any child subtasks so the
    // parent task's history view shows the full picture.
    if (entityType === 'task') {
      const subs = await this.taskRepository.find({
        where: { firmId, parentTaskId: entityId },
        select: ['id'],
      });
      const ids = [entityId, ...subs.map((s) => s.id)];
      return this.auditRepository.find({
        where: { firmId, entityType, entityId: In(ids) },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    }
    return this.auditRepository.find({
      where: { firmId, entityType, entityId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
