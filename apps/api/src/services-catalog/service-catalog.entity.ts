import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum RecurrenceDefault {
  None = 'none',
  Weekly = 'weekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
  Custom = 'custom',
}

@Entity({ name: 'services_catalog' })
@Index(['firmId', 'code'], { unique: true })
export class ServiceCatalog extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 60 })
  code!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'default_workflow_id', type: 'varchar', length: 36, nullable: true })
  defaultWorkflowId?: string | null;

  @Column({ name: 'default_billing_amount', type: 'bigint', nullable: true })
  defaultBillingAmount?: string | null;

  @Column({ name: 'default_team_id', type: 'varchar', length: 36, nullable: true })
  defaultTeamId?: string | null;

  @Column({ name: 'default_assignee_strategy', type: 'varchar', length: 60, nullable: true })
  defaultAssigneeStrategy?: string | null;

  @Column({ name: 'recurrence_default', type: 'enum', enum: RecurrenceDefault, default: RecurrenceDefault.None })
  recurrenceDefault!: RecurrenceDefault;

  @Column({ name: 'hsn_sac', type: 'varchar', length: 20, nullable: true })
  hsnSac?: string | null;

  @Column({ name: 'default_gst_rate', type: 'decimal', precision: 5, scale: 2, nullable: true })
  defaultGstRate?: string | null;

  @Column({ name: 'default_hourly_rate', type: 'bigint', nullable: true })
  defaultHourlyRate?: string | null; // paise per hour, used for revenue calc on time logs
}
