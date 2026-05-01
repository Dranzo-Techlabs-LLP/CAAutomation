import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'time_logs' })
@Index(['firmId', 'taskId'])
@Index(['taskId', 'userId'])
export class TimeLog extends TenantAuditColumns {
  @Column({ name: 'task_id', type: 'varchar', length: 36 })
  taskId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'started_at', type: 'datetime', precision: 6 })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'datetime', precision: 6, nullable: true })
  endedAt?: Date | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes?: number | null;

  @Column({ name: 'is_billable', type: 'boolean', default: true })
  isBillable!: boolean;

  @Column({ name: 'hourly_rate', type: 'bigint', nullable: true })
  hourlyRate?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'boolean', default: false })
  locked!: boolean;
}
