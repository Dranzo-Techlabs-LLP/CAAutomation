import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'api_keys' })
@Index(['firmId', 'isActive'])
export class ApiKey extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Index({ unique: true })
  @Column({ name: 'key_hash', type: 'varchar', length: 255 })
  keyHash!: string;

  @Column({ name: 'scopes_json', type: 'json' })
  scopesJson!: string[];

  @Column({ name: 'last_used_at', type: 'datetime', precision: 6, nullable: true })
  lastUsedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6, nullable: true })
  expiresAt?: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'created_by_user_id', type: 'varchar', length: 36 })
  createdByUserId!: string;
}
