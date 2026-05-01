import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum RecurrencePatternType {
  Weekly = 'weekly',
  Monthly = 'monthly',
  Quarterly = 'quarterly',
  Yearly = 'yearly',
  CustomCron = 'custom_cron',
  Rrule = 'rrule',
}

export enum AssignmentStrategy {
  SpecificUser = 'specific_user',
  TeamRoundRobin = 'team_round_robin',
  TeamLeastLoaded = 'team_least_loaded',
  CustomerOwner = 'customer_owner',
  ServiceDefault = 'service_default',
  RoleRoundRobin = 'role_round_robin',
}

@Entity({ name: 'task_recurrences' })
@Index(['firmId', 'isActive', 'nextRunAt'])
@Index(['firmId', 'customerId', 'serviceId'])
export class TaskRecurrence extends TenantAuditColumns {
  @Column({ name: 'service_id', type: 'varchar', length: 36 })
  serviceId!: string;

  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Column({ name: 'pattern_type', type: 'enum', enum: RecurrencePatternType })
  patternType!: RecurrencePatternType;

  @Column({ name: 'pattern_expression', type: 'varchar', length: 500 })
  patternExpression!: string;

  @Column({ type: 'varchar', length: 80, default: 'Asia/Kolkata' })
  timezone!: string;

  @Column({ name: 'start_date', type: 'datetime', precision: 6 })
  startDate!: Date;

  @Column({ name: 'end_date', type: 'datetime', precision: 6, nullable: true })
  endDate?: Date | null;

  @Column({ name: 'next_run_at', type: 'datetime', precision: 6 })
  nextRunAt!: Date;

  @Column({ name: 'last_run_at', type: 'datetime', precision: 6, nullable: true })
  lastRunAt?: Date | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'generate_lead_days', type: 'int', default: 7 })
  generateLeadDays!: number;

  @Column({ name: 'prevent_overlap', type: 'boolean', default: true })
  preventOverlap!: boolean;

  @Column({ name: 'template_json', type: 'json' })
  templateJson!: Record<string, unknown>;

  @Column({ name: 'workflow_id', type: 'varchar', length: 36, nullable: true })
  workflowId?: string | null;

  @Column({ name: 'assignment_strategy', type: 'enum', enum: AssignmentStrategy })
  assignmentStrategy!: AssignmentStrategy;

  @Column({ name: 'assignment_target_user_id', type: 'varchar', length: 36, nullable: true })
  assignmentTargetUserId?: string | null;

  @Column({ name: 'assignment_target_team_id', type: 'varchar', length: 36, nullable: true })
  assignmentTargetTeamId?: string | null;

  @Column({ name: 'assignment_target_role_id', type: 'varchar', length: 36, nullable: true })
  assignmentTargetRoleId?: string | null;

  @Column({ name: 'notify_on_create_user_ids_json', type: 'json', nullable: true })
  notifyOnCreateUserIdsJson?: string[] | null;

  @Column({ name: 'created_by_user_id', type: 'varchar', length: 36 })
  createdByUserId!: string;
}
