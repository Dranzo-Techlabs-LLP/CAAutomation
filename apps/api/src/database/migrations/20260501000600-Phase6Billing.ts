import { MigrationInterface, QueryRunner } from 'typeorm';

export class Phase6Billing20260501000600 implements MigrationInterface {
  name = 'Phase6Billing20260501000600';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE invoices (
        id varchar(36) NOT NULL,
        firm_id varchar(36) NOT NULL,
        customer_id varchar(36) NOT NULL,
        invoice_no varchar(40) NOT NULL,
        issue_date date NOT NULL,
        due_date date NOT NULL,
        currency varchar(3) NOT NULL DEFAULT 'INR',
        subtotal bigint NOT NULL,
        cgst bigint NOT NULL DEFAULT 0,
        sgst bigint NOT NULL DEFAULT 0,
        igst bigint NOT NULL DEFAULT 0,
        total bigint NOT NULL,
        status enum('draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled') NOT NULL DEFAULT 'draft',
        notes text NULL,
        terms text NULL,
        pdf_url varchar(500) NULL,
        created_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updated_at datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted_at datetime(6) NULL,
        created_by varchar(36) NULL,
        updated_by varchar(36) NULL,
        INDEX IDX_invoices_firm_id (firm_id),
        INDEX IDX_invoices_firm_customer (firm_id, customer_id),
        UNIQUE INDEX IDX_invoices_firm_no (firm_id, invoice_no),
        PRIMARY KEY (id),
        CONSTRAINT FK_invoices_firm FOREIGN KEY (firm_id) REFERENCES firms(id),
        CONSTRAINT FK_invoices_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE invoice_line_items (
        id varchar(36) NOT NULL,
        invoice_id varchar(36) NOT NULL,
        task_id varchar(36) NULL,
        service_id varchar(36) NULL,
        description varchar(255) NOT NULL,
        quantity decimal(10,2) NOT NULL DEFAULT 1.00,
        rate bigint NOT NULL,
        amount bigint NOT NULL,
        hsn_sac varchar(20) NULL,
        INDEX IDX_invoice_line_items_invoice (invoice_id),
        PRIMARY KEY (id),
        CONSTRAINT FK_invoice_line_items_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        CONSTRAINT FK_invoice_line_items_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE SET NULL,
        CONSTRAINT FK_invoice_line_items_service FOREIGN KEY (service_id) REFERENCES services_catalog(id) ON DELETE SET NULL
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE payments (
        id varchar(36) NOT NULL,
        invoice_id varchar(36) NOT NULL,
        paid_on date NOT NULL,
        amount bigint NOT NULL,
        mode enum('cash', 'upi', 'neft', 'cheque', 'other') NOT NULL,
        reference_no varchar(120) NULL,
        recorded_by_user_id varchar(36) NOT NULL,
        INDEX IDX_payments_invoice_paid_on (invoice_id, paid_on),
        PRIMARY KEY (id),
        CONSTRAINT FK_payments_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
        CONSTRAINT FK_payments_recorded_by FOREIGN KEY (recorded_by_user_id) REFERENCES users(id)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query('ALTER TABLE tasks ADD CONSTRAINT FK_tasks_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE tasks DROP FOREIGN KEY FK_tasks_invoice');
    await queryRunner.query('DROP TABLE payments');
    await queryRunner.query('DROP TABLE invoice_line_items');
    await queryRunner.query('DROP TABLE invoices');
  }
}
