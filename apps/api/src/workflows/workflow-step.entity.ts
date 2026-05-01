import { Column, Entity, Index } from 'typeorm';
import { AuditColumns } from '../common/entities/audit-columns';

export enum StepAssigneeStrategy {
  SpecificUser = 'specific_user',
  Role = 'role',
  TeamRoundRobin = 'team_round_robin',
  TeamLeastLoaded = 'team_least_loaded',
  RoundRobin = 'round_robin',
  CustomerOwner = 'customer_owner',
  PreviousStepAssignee = 'previous_step_assignee',
}

export enum OnCompleteAction {
  NextStep = 'next_step',
  Branch = 'branch',
  End = 'end',
  Notify = 'notify',
  GenerateInvoice = 'generate_invoice',
}

@Entity({ name: 'workflow_steps' })
@Index(['workflowId', 'sequenceNo'], { unique: true })
export class WorkflowStep extends AuditColumns {
  @Column({ name: 'workflow_id', type: 'varchar', length: 36 })
  workflowId!: string;

  @Column({ name: 'sequence_no', type: 'int' })
  sequenceNo!: number;

  @Column({ type: 'varchar', length: 160 })
  name!: string;

  @Column({ name: 'assignee_strategy', type: 'enum', enum: StepAssigneeStrategy })
  assigneeStrategy!: StepAssigneeStrategy;

  @Column({ name: 'assignee_value', type: 'varchar', length: 120, nullable: true })
  assigneeValue?: string | null;

  @Column({ name: 'sla_hours', type: 'int', nullable: true })
  slaHours?: number | null;

  @Column({ name: 'requires_attachment', type: 'boolean', default: false })
  requiresAttachment!: boolean;

  @Column({ name: 'requires_approval', type: 'boolean', default: false })
  requiresApproval!: boolean;

  @Column({ name: 'approver_role_id', type: 'varchar', length: 36, nullable: true })
  approverRoleId?: string | null;

  @Column({ name: 'on_complete_action', type: 'enum', enum: OnCompleteAction, default: OnCompleteAction.NextStep })
  onCompleteAction!: OnCompleteAction;

  @Column({ name: 'branch_condition_json', type: 'json', nullable: true })
  branchConditionJson?: Record<string, unknown> | null;
}
