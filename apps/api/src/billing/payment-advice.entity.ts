import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { PaymentMode } from './payment.entity';

export enum PaymentAdviceType {
  Received = 'received', // we received money from a customer
  Made = 'made', // we paid a vendor / refund
}

export enum PaymentAdviceStatus {
  Draft = 'draft',
  Issued = 'issued',
  Cancelled = 'cancelled',
}

@Entity({ name: 'payment_advices' })
@Index(['firmId', 'adviceNo'], { unique: true })
@Index(['firmId', 'customerId'])
@Index(['firmId', 'invoiceId'])
export class PaymentAdvice extends TenantAuditColumns {
  @Column({ name: 'advice_no', type: 'varchar', length: 40 })
  adviceNo!: string;

  @Column({ name: 'advice_date', type: 'date' })
  adviceDate!: string;

  @Column({ type: 'enum', enum: PaymentAdviceType, default: PaymentAdviceType.Received })
  type!: PaymentAdviceType;

  @Column({ name: 'customer_id', type: 'varchar', length: 36, nullable: true })
  customerId?: string | null;

  // For "made" type, vendor info typed in directly
  @Column({ name: 'party_name', type: 'varchar', length: 200, nullable: true })
  partyName?: string | null;

  @Column({ name: 'party_gstin', type: 'varchar', length: 20, nullable: true })
  partyGstin?: string | null;

  @Column({ name: 'party_pan', type: 'varchar', length: 15, nullable: true })
  partyPan?: string | null;

  @Column({ name: 'party_address', type: 'text', nullable: true })
  partyAddress?: string | null;

  @Column({ name: 'invoice_id', type: 'varchar', length: 36, nullable: true })
  invoiceId?: string | null;

  // Amounts in paise
  @Column({ name: 'gross_amount', type: 'bigint' })
  grossAmount!: string;

  @Column({ name: 'tds_amount', type: 'bigint', default: 0 })
  tdsAmount!: string;

  @Column({ name: 'tds_section', type: 'varchar', length: 20, nullable: true })
  tdsSection?: string | null;

  @Column({ name: 'tds_rate', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  tdsRate!: string;

  @Column({ name: 'other_deductions', type: 'bigint', default: 0 })
  otherDeductions!: string;

  @Column({ name: 'net_amount', type: 'bigint' })
  netAmount!: string;

  @Column({ type: 'enum', enum: PaymentMode })
  mode!: PaymentMode;

  @Column({ name: 'reference_no', type: 'varchar', length: 120, nullable: true })
  referenceNo?: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 120, nullable: true })
  bankName?: string | null;

  @Column({ name: 'transaction_date', type: 'date', nullable: true })
  transactionDate?: string | null;

  @Column({ type: 'text', nullable: true })
  narration?: string | null;

  @Column({ type: 'enum', enum: PaymentAdviceStatus, default: PaymentAdviceStatus.Issued })
  status!: PaymentAdviceStatus;

  @Column({ name: 'pdf_url', type: 'varchar', length: 500, nullable: true })
  pdfUrl?: string | null;
}
