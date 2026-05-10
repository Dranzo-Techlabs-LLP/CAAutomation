import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'task_statuses' })
@Index(['firmId', 'code'], { unique: true })
@Index(['firmId', 'sortOrder'])
export class TaskStatusEntity extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ type: 'varchar', length: 80 })
  label!: string;

  @Column({ type: 'varchar', length: 40, nullable: true })
  color?: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder!: number;

  @Column({ name: 'is_initial', type: 'boolean', default: false })
  isInitial!: boolean;

  @Column({ name: 'is_terminal', type: 'boolean', default: false })
  isTerminal!: boolean;

  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem!: boolean;
}
