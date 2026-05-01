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
  rate!: string;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ name: 'hsn_sac', type: 'varchar', length: 20, nullable: true })
  hsnSac?: string | null;
}
