import { Exclude } from 'class-transformer';
import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { Role } from '../roles/role.entity';

@Entity({ name: 'users' })
@Index(['firmId', 'isActive'])
export class User extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 190 })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string | null;

  @Exclude()
  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Index()
  @Column({ name: 'role_id', type: 'varchar', length: 36 })
  roleId!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'default_hourly_rate', type: 'bigint', nullable: true })
  defaultHourlyRate?: string | null; // paise per hour, fallback when no task/service rate

  @Column({ name: 'cost_rate', type: 'bigint', nullable: true })
  costRate?: string | null; // paise per hour internal cost (used for margin)

  @Column({ name: 'last_login_at', type: 'datetime', precision: 6, nullable: true })
  lastLoginAt?: Date | null;

  @Exclude()
  @Column({ name: 'mfa_secret', type: 'varchar', length: 255, nullable: true })
  mfaSecret?: string | null;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role!: Role;
}
