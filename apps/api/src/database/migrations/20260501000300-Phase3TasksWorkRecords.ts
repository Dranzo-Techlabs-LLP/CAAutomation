import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase3TasksWorkRecords20260501000300 implements MigrationInterface {
  name = 'Phase3TasksWorkRecords20260501000300';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE services_catalog (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        code varchar(60) NOT NULL,
        name varchar(180) NOT NULL,
        description text NULL,
        default_workflow_id varchar(36) NULL,
        default_billing_amount bigint NULL,
        default_team_id varchar(36) NULL,
        default_assignee_strategy varchar(60) NULL,
        recurrence_default enum('none', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom') NOT NULL DEFAULT 'none',
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_services_catalog_firm_id (firm_id),
        UNIQUE INDEX IDX_services_catalog_firm_code (firm_id, code),
        PRIMARY KEY (id),
        CONSTRAINT FK_services_catalog_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_services_catalog_default_team FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE tasks (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        customer_id varchar(36) NOT NULL,
        service_id varchar(36) NULL,
        parent_task_id varchar(36) NULL,
        workflow_id varchar(36) NULL,
        current_step_id varchar(36) NULL,
        title varchar(220) NOT NULL,
        description text NULL,
        priority enum('low', 'medium', 'high', 'urgent') NOT NULL DEFAULT 'medium',
        status enum('unassigned', 'assigned', 'in_progress', 'on_hold', 'review', 'completed', 'cancelled', 'cancellation_requested') NOT NULL DEFAULT 'unassigned',
        assigned_to_user_id varchar(36) NULL,
        assigned_team_id varchar(36) NULL,
        due_date datetime(6) NULL,
        started_at datetime(6) NULL,
        completed_at datetime(6) NULL,
        recurrence_id varchar(36) NULL,
        source_recurrence_instance_id varchar(36) NULL,
        generated_by enum('manual', 'recurrence', 'workflow', 'api') NOT NULL DEFAULT 'manual',
        estimated_hours decimal(8,2) NULL,
        billable tinyint NOT NULL DEFAULT 1,
        billing_amount bigint NULL,
        invoice_id varchar(36) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_tasks_firm_id (firm_id),
        INDEX IDX_tasks_firm_status (firm_id, status),
        INDEX IDX_tasks_firm_customer (firm_id, customer_id),
        INDEX IDX_tasks_firm_assignee_status (firm_id, assigned_to_user_id, status),
        INDEX IDX_tasks_firm_due_date (firm_id, due_date),
        UNIQUE INDEX IDX_tasks_recurrence_due_date (recurrence_id, due_date),
        PRIMARY KEY (id),
        CONSTRAINT FK_tasks_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_tasks_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
        CONSTRAINT FK_tasks_service FOREIGN KEY (service_id) REFERENCES services_catalog(id) ON DELETE SET NULL,
        CONSTRAINT FK_tasks_parent FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        CONSTRAINT FK_tasks_assignee FOREIGN KEY (assigned_to_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT FK_tasks_team FOREIGN KEY (assigned_team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE task_comments (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        task_id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        body text NOT NULL,
        mentions_json json NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_task_comments_firm_id (firm_id),
        INDEX IDX_task_comments_firm_task (firm_id, task_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_task_comments_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_task_comments_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_task_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE attachments (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        entity_type enum('task', 'customer', 'invoice', 'enquiry') NOT NULL,
        entity_id varchar(36) NOT NULL,
        file_name varchar(255) NOT NULL,
        file_url varchar(500) NOT NULL,
        mime_type varchar(120) NOT NULL,
        size_bytes bigint NOT NULL,
        uploaded_by_user_id varchar(36) NOT NULL,
        tag enum('evidence', 'proposal', 'signed_doc', 'other') NOT NULL DEFAULT 'other',
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_attachments_firm_id (firm_id),
        INDEX IDX_attachments_entity (firm_id, entity_type, entity_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_attachments_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_attachments_uploader FOREIGN KEY (uploaded_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE time_logs (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        task_id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        started_at datetime(6) NOT NULL,
        ended_at datetime(6) NULL,
        duration_minutes int NULL,
        is_billable tinyint NOT NULL DEFAULT 1,
        hourly_rate bigint NULL,
        notes text NULL,
        locked tinyint NOT NULL DEFAULT 0,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_time_logs_firm_id (firm_id),
        INDEX IDX_time_logs_firm_task (firm_id, task_id),
        INDEX IDX_time_logs_task_user (task_id, user_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_time_logs_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_time_logs_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        CONSTRAINT FK_time_logs_user FOREIGN KEY (user_id) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE time_logs');
    await queryRunner.query('DROP TABLE attachments');
    await queryRunner.query('DROP TABLE task_comments');
    await queryRunner.query('DROP TABLE tasks');
    await queryRunner.query('DROP TABLE services_catalog');
  }
}
