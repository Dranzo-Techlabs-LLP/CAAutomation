import { Column, Entity, Index, OneToMany } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { RolePermission } from './role-permission.entity';

@Entity({ name: 'roles' })
@Index(['firmId', 'name'], { unique: true })
export class Role extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'is_system_role', type: 'boolean', default: false })
  isSystemRole!: boolean;

  @OneToMany(() => RolePermission, (rolePermission) => rolePermission.role)
  rolePermissions!: RolePermission[];
}
