import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum RuleEventEntity {
  Task = 'task',
  Customer = 'customer',
  Enquiry = 'enquiry',
}

export enum RuleEventType {
  Created = 'created',
  Updated = 'updated',
  StatusChanged = 'status_changed',
  Assigned = 'assigned',
  ResolutionAdded = 'resolution_added',
  PriorityChanged = 'priority_changed',
}

export enum ConditionField {
  Status = 'status',
  Priority = 'priority',
  ServiceId = 'serviceId',
  AssignedToUserId = 'assignedToUserId',
  AssignedTeamId = 'assignedTeamId',
  CustomerId = 'customerId',
  GeneratedBy = 'generatedBy',
}

export enum ConditionOperator {
  Equals = 'equals',
  NotEquals = 'not_equals',
  In = 'in',
  NotIn = 'not_in',
  IsNull = 'is_null',
  IsNotNull = 'is_not_null',
}

export enum ActionType {
  SetStatus = 'set_status',
  SetPriority = 'set_priority',
  AssignToUser = 'assign_to_user',
  AssignToTeam = 'assign_to_team',
  SetResolution = 'set_resolution',
  StartWorkflow = 'start_workflow',
  CreateNotification = 'create_notification',
}

export interface RuleEvent {
  entity: RuleEventEntity;
  type: RuleEventType;
}

export interface RuleCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: string | string[] | null;
  logic?: 'and' | 'or';
}

export interface RuleAction {
  type: ActionType;
  value: string;
}

@Entity({ name: 'automation_rules' })
@Index(['firmId', 'isActive'])
export class AutomationRule extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'json' })
  events!: RuleEvent[];

  @Column({ type: 'json' })
  conditions!: RuleCondition[];

  @Column({ type: 'json' })
  actions!: RuleAction[];

  @Column({ type: 'int', default: 0 })
  priority!: number;
}
