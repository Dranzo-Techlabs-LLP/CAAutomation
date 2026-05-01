import { Column, Entity, Index } from 'typeorm';
import { AuditColumns } from '../common/entities/audit-columns';

@Entity({ name: 'permissions' })
export class Permission extends AuditColumns {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 120 })
  code!: string;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Index()
  @Column({ type: 'varchar', length: 80 })
  module!: string;
}
