import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum TaskPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Urgent = 'urgent',
}

export enum TaskStatus {
  Unassigned = 'unassigned',
  Assigned = 'assigned',
  InProgress = 'in_progress',
  OnHold = 'on_hold',
  Review = 'review',
  Completed = 'completed',
  Cancelled = 'cancelled',
  CancellationRequested = 'cancellation_requested',
}

export enum TaskGeneratedBy {
  Manual = 'manual',
  Recurrence = 'recurrence',
  Workflow = 'workflow',
  Api = 'api',
}

@Entity({ name: 'tasks' })
@Index(['firmId', 'status'])
@Index(['firmId', 'customerId'])
@Index(['firmId', 'assignedToUserId', 'status'])
@Index(['firmId', 'dueDate'])
@Index(['recurrenceId', 'dueDate'], { unique: true })
export class Task extends TenantAuditColumns {
  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  serviceId?: string | null;

  @Column({ name: 'parent_task_id', type: 'varchar', length: 36, nullable: true })
  parentTaskId?: string | null;

  @Column({ name: 'workflow_id', type: 'varchar', length: 36, nullable: true })
  workflowId?: string | null;

  @Column({ name: 'current_step_id', type: 'varchar', length: 36, nullable: true })
  currentStepId?: string | null;

  @Column({ type: 'varchar', length: 220 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ type: 'text', nullable: true })
  resolution?: string | null;

  @Column({ type: 'enum', enum: TaskPriority, default: TaskPriority.Medium })
  priority!: TaskPriority;

  @Column({ type: 'enum', enum: TaskStatus, default: TaskStatus.Unassigned })
  status!: TaskStatus;

  @Column({ name: 'assigned_to_user_id', type: 'varchar', length: 36, nullable: true })
  assignedToUserId?: string | null;

  @Column({ name: 'assigned_team_id', type: 'varchar', length: 36, nullable: true })
  assignedTeamId?: string | null;

  @Column({ name: 'due_date', type: 'datetime', precision: 6, nullable: true })
  dueDate?: Date | null;

  @Column({ name: 'staff_due_date', type: 'datetime', precision: 6, nullable: true })
  staffDueDate?: Date | null;

  @Column({ name: 'review_date', type: 'datetime', precision: 6, nullable: true })
  reviewDate?: Date | null;

  @Column({ name: 'client_due_date', type: 'datetime', precision: 6, nullable: true })
  clientDueDate?: Date | null;

  @Column({ name: 'started_at', type: 'datetime', precision: 6, nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: 'datetime', precision: 6, nullable: true })
  completedAt?: Date | null;

  @Column({ name: 'recurrence_id', type: 'varchar', length: 36, nullable: true })
  recurrenceId?: string | null;

  @Column({ name: 'source_recurrence_instance_id', type: 'varchar', length: 36, nullable: true })
  sourceRecurrenceInstanceId?: string | null;

  @Column({ name: 'generated_by', type: 'enum', enum: TaskGeneratedBy, default: TaskGeneratedBy.Manual })
  generatedBy!: TaskGeneratedBy;

  @Column({ name: 'estimated_hours', type: 'decimal', precision: 8, scale: 2, nullable: true })
  estimatedHours?: string | null;

  @Column({ type: 'boolean', default: true })
  billable!: boolean;

  @Column({ name: 'billing_amount', type: 'bigint', nullable: true })
  billingAmount?: string | null;

  @Column({ name: 'invoice_id', type: 'varchar', length: 36, nullable: true })
  invoiceId?: string | null;
}
