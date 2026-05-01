import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum InvoiceStatus {
  Draft = 'draft',
  Sent = 'sent',
  PartiallyPaid = 'partially_paid',
  Paid = 'paid',
  Overdue = 'overdue',
  Cancelled = 'cancelled',
}

@Entity({ name: 'invoices' })
@Index(['firmId', 'customerId'])
@Index(['firmId', 'invoiceNo'], { unique: true })
export class Invoice extends TenantAuditColumns {
  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ name: 'invoice_no', type: 'varchar', length: 40 })
  invoiceNo!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency!: string;

  @Column({ type: 'bigint' })
  subtotal!: string;

  @Column({ type: 'bigint', default: 0 })
  cgst!: string;

  @Column({ type: 'bigint', default: 0 })
  sgst!: string;

  @Column({ type: 'bigint', default: 0 })
  igst!: string;

  @Column({ type: 'bigint' })
  total!: string;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.Draft })
  status!: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'text', nullable: true })
  terms?: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string | null;
}
