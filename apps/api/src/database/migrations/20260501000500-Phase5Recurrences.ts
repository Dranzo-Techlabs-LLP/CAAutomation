import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase5Recurrences20260501000500 implements MigrationInterface {
  name = 'Phase5Recurrences20260501000500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE task_recurrences (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        service_id varchar(36) NOT NULL,
        customer_id varchar(36) NOT NULL,
        name varchar(180) NOT NULL,
        pattern_type enum('weekly', 'monthly', 'quarterly', 'yearly', 'custom_cron', 'rrule') NOT NULL,
        pattern_expression varchar(500) NOT NULL,
        timezone varchar(80) NOT NULL DEFAULT 'Asia/Kolkata',
        start_date datetime(6) NOT NULL,
        end_date datetime(6) NULL,
        next_run_at datetime(6) NOT NULL,
        last_run_at datetime(6) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        generate_lead_days int NOT NULL DEFAULT 7,
        prevent_overlap tinyint NOT NULL DEFAULT 1,
        template_json json NOT NULL,
        workflow_id varchar(36) NULL,
        assignment_strategy enum('specific_user', 'team_round_robin', 'team_least_loaded', 'customer_owner', 'service_default', 'role_round_robin') NOT NULL,
        assignment_target_user_id varchar(36) NULL,
        assignment_target_team_id varchar(36) NULL,
        assignment_target_role_id varchar(36) NULL,
        notify_on_create_user_ids_json json NULL,
        created_by_user_id varchar(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_task_recurrences_firm_id (firm_id),
        INDEX IDX_task_recurrences_active_next (firm_id, is_active, next_run_at),
        INDEX IDX_task_recurrences_customer_service (firm_id, customer_id, service_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_task_recurrences_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_task_recurrences_service FOREIGN KEY (service_id) REFERENCES services_catalog(id),
        CONSTRAINT FK_task_recurrences_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
        CONSTRAINT FK_task_recurrences_workflow FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE SET NULL,
        CONSTRAINT FK_task_recurrences_target_user FOREIGN KEY (assignment_target_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT FK_task_recurrences_target_team FOREIGN KEY (assignment_target_team_id) REFERENCES teams(id) ON DELETE SET NULL,
        CONSTRAINT FK_task_recurrences_target_role FOREIGN KEY (assignment_target_role_id) REFERENCES roles(id) ON DELETE SET NULL,
        CONSTRAINT FK_task_recurrences_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE recurrence_run_log (
        id varchar(36) NOT NULL,
        recurrence_id varchar(36) NOT NULL,
        run_at datetime(6) NOT NULL,
        due_date_generated datetime(6) NULL,
        task_id_created varchar(36) NULL,
        status enum('success', 'skipped', 'failed') NOT NULL,
        skip_reason varchar(255) NULL,
        error_message text NULL,
        INDEX IDX_recurrence_run_log_recurrence_run (recurrence_id, run_at),
        PRIMARY KEY (id),
        CONSTRAINT FK_recurrence_run_log_recurrence FOREIGN KEY (recurrence_id) REFERENCES task_recurrences(id) ON DELETE CASCADE,
        CONSTRAINT FK_recurrence_run_log_task FOREIGN KEY (task_id_created) REFERENCES tasks(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query('ALTER TABLE tasks ADD CONSTRAINT FK_tasks_recurrence FOREIGN KEY (recurrence_id) REFERENCES task_recurrences(id) ON DELETE SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP FOREIGN KEY FK_tasks_recurrence');
    await queryRunner.query('DROP TABLE recurrence_run_log');
    await queryRunner.query('DROP TABLE task_recurrences');
  }
}
