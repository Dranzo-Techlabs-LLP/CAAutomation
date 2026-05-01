import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase4Workflows20260501000400 implements MigrationInterface {
  name = 'Phase4Workflows20260501000400';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE workflows (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        name varchar(180) NOT NULL,
        description text NULL,
        applies_to varchar(80) NOT NULL DEFAULT 'any',
        is_active tinyint NOT NULL DEFAULT 1,
        version int NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_workflows_firm_id (firm_id),
        UNIQUE INDEX IDX_workflows_firm_name_version (firm_id, name, version),
        PRIMARY KEY (id),
        CONSTRAINT FK_workflows_firm FOREIGN KEY (firm_id) REFERENCES firms(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE workflow_steps (
        id varchar(36) NOT NULL,
        workflow_id varchar(36) NOT NULL,
        sequence_no int NOT NULL,
        name varchar(160) NOT NULL,
        assignee_strategy enum('specific_user', 'role', 'team_round_robin', 'team_least_loaded', 'round_robin', 'customer_owner', 'previous_step_assignee') NOT NULL,
        assignee_value varchar(120) NULL,
        sla_hours int NULL,
        requires_attachment tinyint NOT NULL DEFAULT 0,
        requires_approval tinyint NOT NULL DEFAULT 0,
        approver_role_id varchar(36) NULL,
        on_complete_action enum('next_step', 'branch', 'end', 'notify', 'generate_invoice') NOT NULL DEFAULT 'next_step',
        branch_condition_json json NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        UNIQUE INDEX IDX_workflow_steps_workflow_sequence (workflow_id, sequence_no),
        PRIMARY KEY (id),
        CONSTRAINT FK_workflow_steps_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE workflow_step_transitions (
        id varchar(36) NOT NULL,
        from_step_id varchar(36) NOT NULL,
        to_step_id varchar(36) NOT NULL,
        condition_expression varchar(500) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_workflow_step_transitions_steps (from_step_id, to_step_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_workflow_transitions_from FOREIGN KEY (from_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE,
        CONSTRAINT FK_workflow_transitions_to FOREIGN KEY (to_step_id) REFERENCES workflow_steps(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE task_step_history (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        task_id varchar(36) NOT NULL,
        step_id varchar(36) NOT NULL,
        status enum('started', 'completed', 'skipped') NOT NULL,
        started_at datetime(6) NULL,
        completed_at datetime(6) NULL,
        completed_by_user_id varchar(36) NULL,
        notes text NULL,
        attachments_count int NOT NULL DEFAULT 0,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_task_step_history_firm_id (firm_id),
        INDEX IDX_task_step_history_firm_task (firm_id, task_id),
        INDEX IDX_task_step_history_task_step (task_id, step_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_task_step_history_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_task_step_history_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_step_history_step FOREIGN KEY (step_id) REFERENCES workflow_steps(id),
        CONSTRAINT FK_task_step_history_completed_by FOREIGN KEY (completed_by_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query('ALTER TABLE services_catalog ADD CONSTRAINT FK_services_catalog_default_workflow FOREIGN KEY (default_workflow_id) REFERENCES workflows(id) ON DELETE SET NULL');
    await queryRunner.query('ALTER TABLE tasks ADD CONSTRAINT FK_tasks_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL');
    await queryRunner.query('ALTER TABLE tasks ADD CONSTRAINT FK_tasks_current_step FOREIGN KEY (current_step_id) REFERENCES workflow_steps(id) ON DELETE SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP FOREIGN KEY FK_tasks_current_step');
    await queryRunner.query('ALTER TABLE tasks DROP FOREIGN KEY FK_tasks_workflow');
    await queryRunner.query('ALTER TABLE services_catalog DROP FOREIGN KEY FK_services_catalog_default_workflow');
    await queryRunner.query('DROP TABLE task_step_history');
    await queryRunner.query('DROP TABLE workflow_step_transitions');
    await queryRunner.query('DROP TABLE workflow_steps');
    await queryRunner.query('DROP TABLE workflows');
  }
}
