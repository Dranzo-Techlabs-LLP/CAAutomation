import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export enum PaymentMode {
  Cash = 'cash',
  Upi = 'upi',
  Neft = 'neft',
  Cheque = 'cheque',
  Other = 'other',
}

@Entity({ name: 'payments' })
@Index(['invoiceId', 'paidOn'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'invoice_id', type: 'varchar', length: 36 })
  invoiceId!: string;

  @Column({ name: 'paid_on', type: 'date' })
  paidOn!: string;

  @Column({ type: 'bigint' })
  amount!: string;

  @Column({ type: 'enum', enum: PaymentMode })
  mode!: PaymentMode;

  @Column({ name: 'reference_no', type: 'varchar', length: 120, nullable: true })
  referenceNo?: string | null;

  @Column({ name: 'recorded_by_user_id', type: 'varchar', length: 36 })
  recordedByUserId!: string;
}
