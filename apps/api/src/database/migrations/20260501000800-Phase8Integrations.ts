import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase8Integrations20260501000800 implements MigrationInterface {
  name = 'Phase8Integrations20260501000800';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE api_keys (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        name varchar(120) NOT NULL,
        key_hash varchar(255) NOT NULL,
        scopes_json json NOT NULL,
        last_used_at datetime(6) NULL,
        expires_at datetime(6) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_by_user_id varchar(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_api_keys_firm_id (firm_id),
        INDEX IDX_api_keys_firm_active (firm_id, is_active),
        UNIQUE INDEX IDX_api_keys_hash (key_hash),
        PRIMARY KEY (id),
        CONSTRAINT FK_api_keys_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_api_keys_created_by FOREIGN KEY (created_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE webhooks (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        url varchar(500) NOT NULL,
        events_json json NOT NULL,
        secret varchar(255) NOT NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_webhooks_firm_id (firm_id),
        INDEX IDX_webhooks_firm_active (firm_id, is_active),
        PRIMARY KEY (id),
        CONSTRAINT FK_webhooks_firm FOREIGN KEY (firm_id) REFERENCES firms(id)
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE webhooks');
    await queryRunner.query('DROP TABLE api_keys');
  }
}
