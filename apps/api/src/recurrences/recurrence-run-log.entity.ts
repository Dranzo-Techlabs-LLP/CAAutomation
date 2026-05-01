import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum RecurrenceRunStatus {
  Success = 'success',
  Skipped = 'skipped',
  Failed = 'failed',
}

@Entity({ name: 'recurrence_run_log' })
@Index(['recurrenceId', 'runAt'])
export class RecurrenceRunLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'recurrence_id', type: 'varchar', length: 36 })
  recurrenceId!: string;

  @Column({ name: 'run_at', type: 'datetime', precision: 6 })
  runAt!: Date;

  @Column({ name: 'due_date_generated', type: 'datetime', precision: 6, nullable: true })
  dueDateGenerated?: Date | null;

  @Column({ name: 'task_id_created', type: 'varchar', length: 36, nullable: true })
  taskIdCreated?: string | null;

  @Column({ type: 'enum', enum: RecurrenceRunStatus })
  status!: RecurrenceRunStatus;

  @Column({ name: 'skip_reason', type: 'varchar', length: 255, nullable: true })
  skipReason?: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string | null;
}
