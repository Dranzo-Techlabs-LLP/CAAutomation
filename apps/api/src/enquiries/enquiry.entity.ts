import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { Customer, EnquirySource } from '../customers/customer.entity';

export enum EnquiryStatus {
  Open = 'open',
  ProposalSent = 'proposal_sent',
  Converted = 'converted',
  Lost = 'lost',
  OnHold = 'on_hold',
}

@Entity({ name: 'enquiries' })
@Index(['firmId', 'status'])
@Index(['firmId', 'customerId'])
export class Enquiry extends TenantAuditColumns {
  @Column({ name: 'customer_id', type: 'varchar', length: 36 })
  customerId!: string;

  @Column({ type: 'enum', enum: EnquirySource })
  source!: EnquirySource;

  @Column({ type: 'text', nullable: true })
  brief?: string | null;

  @Column({ name: 'requirements_json', type: 'json', nullable: true })
  requirementsJson?: Record<string, unknown> | null;

  @Column({ type: 'enum', enum: EnquiryStatus, default: EnquiryStatus.Open })
  status!: EnquiryStatus;

  @Column({ name: 'proposal_amount', type: 'bigint', nullable: true })
  proposalAmount?: string | null;

  @Column({ name: 'proposal_doc_url', type: 'varchar', length: 500, nullable: true })
  proposalDocUrl?: string | null;

  @Column({ name: 'lost_reason', type: 'text', nullable: true })
  lostReason?: string | null;

  @Column({ name: 'converted_at', type: 'datetime', precision: 6, nullable: true })
  convertedAt?: Date | null;

  @Column({ name: 'service_id', type: 'varchar', length: 36, nullable: true })
  serviceId?: string | null;

  @Column({ name: 'referral_name', type: 'varchar', length: 255, nullable: true })
  referralName?: string | null;

  @Column({ name: 'referral_contact', type: 'varchar', length: 50, nullable: true })
  referralContact?: string | null;

  @Column({ name: 'referral_details', type: 'text', nullable: true })
  referralDetails?: string | null;

  @ManyToOne(() => Customer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;
}
