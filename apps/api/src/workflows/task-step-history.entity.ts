import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum TaskStepHistoryStatus {
  Started = 'started',
  Completed = 'completed',
  Skipped = 'skipped',
}

@Entity({ name: 'task_step_history' })
@Index(['firmId', 'taskId'])
@Index(['taskId', 'stepId'])
export class TaskStepHistory extends TenantAuditColumns {
  @Column({ name: 'task_id', type: 'varchar', length: 36 })
  taskId!: string;

  @Column({ name: 'step_id', type: 'varchar', length: 36 })
  stepId!: string;

  @Column({ type: 'enum', enum: TaskStepHistoryStatus })
  status!: TaskStepHistoryStatus;

  @Column({ name: 'started_at', type: 'datetime', precision: 6, nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', precision: 6, nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'completed_by_user_id', type: 'varchar', length: 36, nullable: true })
  completedByUserId?: string | null;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ name: 'attachments_count', type: 'int', default: 0 })
  attachmentsCount!: number;
}
