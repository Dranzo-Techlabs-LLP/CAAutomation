import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'invoice_line_items' })
@Index(['invoiceId'])
export class InvoiceLineItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_id', type: 'varchar', length: 36 })
  invoiceId!: string;

  @Column({ name: 'task_id', type: 'varchar', length: 36, nullable: true })
  taskId?: string | null;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  serviceId?: string | null;

  @Column({ type: 'varchar', length: 255 })
  description!: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: '1.00' })
  quantity!: string;

  @Column({ type: 'bigint' })
  rate!: string; // paise per unit

  @Column({ type: 'bigint' })
  amount!: string; // qty * rate (taxable value)

  @Column({ name: 'hsn_sac', type: 'varchar', length: 20, nullable: true })
  hsnSac?: string | null;

  // Per-line GST
  @Column({ name: 'gst_rate', type: 'decimal', precision: 5, scale: 2, default: '18.00' })
  gstRate!: string; // 0/5/12/18/28

  @Column({ name: 'cgst_amount', type: 'bigint', default: 0 })
  cgstAmount!: string;

  @Column({ name: 'sgst_amount', type: 'bigint', default: 0 })
  sgstAmount!: string;

  @Column({ name: 'igst_amount', type: 'bigint', default: 0 })
  igstAmount!: string;

  @Column({ name: 'cess_amount', type: 'bigint', default: 0 })
  cessAmount!: string;

  @Column({ name: 'cess_rate', type: 'decimal', precision: 5, scale: 2, default: '0.00' })
  cessRate!: string;
}
