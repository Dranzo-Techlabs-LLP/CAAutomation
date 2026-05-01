import { Column, Entity, Index } from 'typeorm';
import { AuditColumns } from '../common/entities/audit-columns';

@Entity({ name: 'workflow_step_transitions' })
@Index(['fromStepId', 'toStepId'])
export class WorkflowStepTransition extends AuditColumns {
  @Column({ name: 'from_step_id', type: 'varchar', length: 36 })
  fromStepId!: string;

  @Column({ name: 'to_step_id', type: 'varchar', length: 36 })
  toStepId!: string;

  @Column({ name: 'condition_expression', type: 'varchar', length: 500, nullable: true })
  conditionExpression?: string | null;
}
