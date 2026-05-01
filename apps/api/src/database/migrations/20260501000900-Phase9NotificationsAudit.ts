import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase9NotificationsAudit20260501000900 implements MigrationInterface {
  name = 'Phase9NotificationsAudit20260501000900';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE audit_logs (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        user_id varchar(36) NULL,
        action varchar(120) NOT NULL,
        entity_type varchar(80) NOT NULL,
        entity_id varchar(36) NOT NULL,
        before_json json NULL,
        after_json json NULL,
        ip varchar(64) NULL,
        user_agent varchar(500) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_audit_logs_firm_entity (firm_id, entity_type, entity_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_audit_logs_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE notifications (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        type varchar(80) NOT NULL,
        payload_json json NOT NULL,
        read_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX IDX_notifications_user_unread (firm_id, user_id, read_at),
        PRIMARY KEY (id),
        CONSTRAINT FK_notifications_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE notifications');
    await queryRunner.query('DROP TABLE audit_logs');
  }
}
