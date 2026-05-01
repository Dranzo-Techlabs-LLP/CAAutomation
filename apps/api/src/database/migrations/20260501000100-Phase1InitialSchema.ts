import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase1InitialSchema20260501000100 implements MigrationInterface {
  name = 'Phase1InitialSchema20260501000100';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE firms (
        id varchar(36) NOT NULL,
        name varchar(180) NOT NULL,
        gstin varchar(15) NULL,
        pan varchar(10) NULL,
        address text NULL,
        logo_url varchar(500) NULL,
        settings_json json NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        UNIQUE INDEX IDX_firms_gstin (gstin),
        UNIQUE INDEX IDX_firms_pan (pan),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id varchar(36) NOT NULL,
        code varchar(120) NOT NULL,
        description varchar(255) NOT NULL,
        module varchar(80) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        UNIQUE INDEX IDX_permissions_code (code),
        INDEX IDX_permissions_module (module),
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE roles (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        name varchar(100) NOT NULL,
        is_system_role tinyint NOT NULL DEFAULT 0,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_roles_firm_id (firm_id),
        UNIQUE INDEX IDX_roles_firm_name (firm_id, name),
        PRIMARY KEY (id),
        CONSTRAINT FK_roles_firm FOREIGN KEY (firm_id) REFERENCES firms(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        role_id varchar(36) NOT NULL,
        permission_id varchar(36) NOT NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        PRIMARY KEY (role_id, permission_id),
        CONSTRAINT FK_role_permissions_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT FK_role_permissions_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE users (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        name varchar(160) NOT NULL,
        email varchar(190) NOT NULL,
        phone varchar(20) NULL,
        password_hash varchar(255) NOT NULL,
        role_id varchar(36) NOT NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        last_login_at datetime(6) NULL,
        mfa_secret varchar(255) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        UNIQUE INDEX IDX_users_email (email),
        INDEX IDX_users_firm_id (firm_id),
        INDEX IDX_users_role_id (role_id),
        INDEX IDX_users_firm_active (firm_id, is_active),
        PRIMARY KEY (id),
        CONSTRAINT FK_users_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE teams (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        name varchar(120) NOT NULL,
        description text NULL,
        lead_user_id varchar(36) NULL,
        last_assigned_user_id varchar(36) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_teams_firm_id (firm_id),
        UNIQUE INDEX IDX_teams_firm_name (firm_id, name),
        INDEX IDX_teams_lead_user_id (lead_user_id),
        INDEX IDX_teams_last_assigned_user_id (last_assigned_user_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_teams_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_teams_lead_user FOREIGN KEY (lead_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT FK_teams_last_assigned_user FOREIGN KEY (last_assigned_user_id) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE team_members (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        team_id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        role_in_team enum('lead', 'member', 'reviewer') NOT NULL DEFAULT 'member',
        is_active tinyint NOT NULL DEFAULT 1,
        joined_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_team_members_firm_id (firm_id),
        UNIQUE INDEX IDX_team_members_team_user (team_id, user_id),
        INDEX IDX_team_members_user_id (user_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_team_members_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_team_members_team FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
        CONSTRAINT FK_team_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE refresh_tokens (
        id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        token_hash varchar(255) NOT NULL,
        expires_at datetime(6) NOT NULL,
        revoked_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_refresh_tokens_user_id (user_id),
        UNIQUE INDEX IDX_refresh_tokens_token_hash (token_hash),
        PRIMARY KEY (id),
        CONSTRAINT FK_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id varchar(36) NOT NULL,
        user_id varchar(36) NOT NULL,
        token_hash varchar(255) NOT NULL,
        expires_at datetime(6) NOT NULL,
        used_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_password_reset_tokens_user_id (user_id),
        UNIQUE INDEX IDX_password_reset_tokens_token_hash (token_hash),
        PRIMARY KEY (id),
        CONSTRAINT FK_password_reset_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE password_reset_tokens');
    await queryRunner.query('DROP TABLE refresh_tokens');
    await queryRunner.query('DROP TABLE team_members');
    await queryRunner.query('DROP TABLE teams');
    await queryRunner.query('DROP TABLE users');
    await queryRunner.query('DROP TABLE role_permissions');
    await queryRunner.query('DROP TABLE roles');
    await queryRunner.query('DROP TABLE permissions');
    await queryRunner.query('DROP TABLE firms');
  }
}
