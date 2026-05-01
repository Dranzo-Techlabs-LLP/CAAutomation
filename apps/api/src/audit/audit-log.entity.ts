import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'audit_logs' })
@Index(['firmId', 'entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'firm_id', type: 'varchar', length: 36 })
  firmId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId?: string | null;

  @Column({ type: 'varchar', length: 120 })
  action!: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 80 })
  entityType!: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId!: string;

  @Column({ name: 'before_json', type: 'json', nullable: true })
  beforeJson?: Record<string, unknown> | null;

  @Column({ name: 'after_json', type: 'json', nullable: true })
  afterJson?: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ip?: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 500, nullable: true })
  userAgent?: string | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;
}
