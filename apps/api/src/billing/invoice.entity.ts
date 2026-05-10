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

export enum GstTreatment {
  Regular = 'regular',
  Composition = 'composition',
  Unregistered = 'unregistered',
  Sez = 'sez',
  Export = 'export',
  ExportWithPayment = 'export_with_payment',
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

  // Tax breakup (paise)
  @Column({ type: 'bigint' })
  subtotal!: string;

  @Column({ type: 'bigint', default: 0 })
  cgst!: string;

  @Column({ type: 'bigint', default: 0 })
  sgst!: string;

  @Column({ type: 'bigint', default: 0 })
  igst!: string;

  @Column({ name: 'cess', type: 'bigint', default: 0 })
  cess!: string;

  @Column({ name: 'tds_paise', type: 'bigint', default: 0 })
  tdsPaise!: string;

  @Column({ name: 'tds_section', type: 'varchar', length: 20, nullable: true })
  tdsSection?: string | null;

  @Column({ name: 'tds_rate', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  tdsRate!: string;

  @Column({ name: 'round_off', type: 'bigint', default: 0 })
  roundOff!: string;

  @Column({ type: 'bigint' })
  total!: string;

  // GST treatment / place-of-supply snapshot
  @Column({ name: 'gst_treatment', type: 'enum', enum: GstTreatment, default: GstTreatment.Regular })
  gstTreatment!: GstTreatment;

  @Column({ name: 'place_of_supply', type: 'varchar', length: 5, nullable: true })
  placeOfSupply?: string | null; // 2-digit state code

  @Column({ name: 'reverse_charge', type: 'boolean', default: false })
  reverseCharge!: boolean;

  @Column({ name: 'customer_gstin_snapshot', type: 'varchar', length: 20, nullable: true })
  customerGstinSnapshot?: string | null;

  @Column({ name: 'customer_state_code', type: 'varchar', length: 5, nullable: true })
  customerStateCode?: string | null;

  @Column({ name: 'customer_name_snapshot', type: 'varchar', length: 200, nullable: true })
  customerNameSnapshot?: string | null;

  @Column({ name: 'customer_address_snapshot', type: 'text', nullable: true })
  customerAddressSnapshot?: string | null;

  // E-invoice / IRN (optional, populated post issuance)
  @Column({ name: 'irn', type: 'varchar', length: 80, nullable: true })
  irn?: string | null;

  @Column({ name: 'amount_in_words', type: 'varchar', length: 500, nullable: true })
  amountInWords?: string | null;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.Draft })
  status!: InvoiceStatus;

  @Column({ type: 'text', nullable: true })
  notes?: string | null;

  @Column({ type: 'text', nullable: true })
  terms?: string | null;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string | null;
}
