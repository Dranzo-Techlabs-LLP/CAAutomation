import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase2CustomersEnquiries20260501000200 implements MigrationInterface {
  name = 'Phase2CustomersEnquiries20260501000200';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE customers (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        type enum('individual', 'company', 'llp', 'partnership', 'trust') NOT NULL,
        name varchar(200) NOT NULL,
        contact_no varchar(20) NULL,
        email varchar(190) NULL,
        gstin varchar(15) NULL,
        pan varchar(10) NULL,
        address text NULL,
        enquiry_source enum('call', 'whatsapp', 'walkin', 'email', 'referral') NOT NULL,
        status enum('enquiry', 'prospect', 'onboarded', 'active', 'inactive', 'churned') NOT NULL DEFAULT 'enquiry',
        brief_text text NULL,
        requirements_json json NULL,
        owner_user_id varchar(36) NULL,
        default_team_id varchar(36) NULL,
        onboarded_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_customers_firm_id (firm_id),
        INDEX IDX_customers_firm_status (firm_id, status),
        INDEX IDX_customers_firm_email (firm_id, email),
        INDEX IDX_customers_firm_owner (firm_id, owner_user_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_customers_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_customers_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT FK_customers_default_team FOREIGN KEY (default_team_id) REFERENCES teams(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE enquiries (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        customer_id varchar(36) NOT NULL,
        source enum('call', 'whatsapp', 'walkin', 'email', 'referral') NOT NULL,
        brief text NULL,
        requirements_json json NULL,
        status enum('open', 'proposal_sent', 'converted', 'lost', 'on_hold') NOT NULL DEFAULT 'open',
        proposal_amount bigint NULL,
        proposal_doc_url varchar(500) NULL,
        lost_reason text NULL,
        converted_at datetime(6) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_enquiries_firm_id (firm_id),
        INDEX IDX_enquiries_firm_status (firm_id, status),
        INDEX IDX_enquiries_firm_customer (firm_id, customer_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_enquiries_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_enquiries_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE enquiries');
    await queryRunner.query('DROP TABLE customers');
  }
}
