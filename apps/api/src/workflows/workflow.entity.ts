import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'workflows' })
@Index(['firmId', 'name', 'version'], { unique: true })
export class Workflow extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'applies_to', type: 'varchar', length: 80, default: 'any' })
  appliesTo!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'int', default: 1 })
  version!: number;
}
