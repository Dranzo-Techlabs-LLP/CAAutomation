import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async write(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    return this.auditRepository.save(this.auditRepository.create(entry));
  }

  async list(firmId: string): Promise<AuditLog[]> {
    return this.auditRepository.find({ where: { firmId }, order: { createdAt: 'DESC' }, take: 200 });
  }
}
