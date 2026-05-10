import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { TaskPriority } from '../tasks/task.entity';

@Entity({ name: 'service_subtask_templates' })
@Index(['firmId', 'serviceId', 'sortOrder'])
export class ServiceSubtaskTemplate extends TenantAuditColumns {
  @Column({ name: 'service_id', type: 'varchar', length: 36 })
  serviceId!: string;

  @Column({ type: 'varchar', length: 220 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'estimated_hours', type: 'decimal', precision: 8, scale: 2, nullable: true })
  estimatedHours?: string | null;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.Medium })
  priority!: TaskPriority;
}
