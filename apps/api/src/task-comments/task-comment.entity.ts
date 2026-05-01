import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'task_comments' })
@Index(['firmId', 'taskId'])
export class TaskComment extends TenantAuditColumns {
  @Column({ name: 'task_id', type: 'varchar', length: 36 })
  taskId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'text' })
  body!: string;

  @Column({ name: 'mentions_json', type: 'json', nullable: true })
  mentionsJson?: string[] | null;
}
