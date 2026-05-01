import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { Team } from '../teams/team.entity';
import { User } from '../users/user.entity';

export enum CustomerType {
  Individual = 'individual',
  Company = 'company',
  Llp = 'llp',
  Partnership = 'partnership',
  Trust = 'trust',
}

export enum EnquirySource {
  Call = 'call',
  Whatsapp = 'whatsapp',
  Walkin = 'walkin',
  Email = 'email',
  Referral = 'referral',
}

export enum CustomerStatus {
  Enquiry = 'enquiry',
  Prospect = 'prospect',
  Onboarded = 'onboarded',
  Active = 'active',
  Inactive = 'inactive',
  Churned = 'churned',
}

@Entity({ name: 'customers' })
@Index(['firmId', 'status'])
@Index(['firmId', 'email'])
@Index(['firmId', 'ownerUserId'])
export class Customer extends TenantAuditColumns {
  @Column({ type: 'enum', enum: CustomerType })
  type!: CustomerType;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ name: 'contact_no', type: 'varchar', length: 20, nullable: true })
  contactNo?: string | null;

  @Column({ type: 'varchar', length: 190, nullable: true })
  email?: string | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  pan?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ name: 'enquiry_source', type: 'enum', enum: EnquirySource })
  enquirySource!: EnquirySource;

  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.Enquiry })
  status!: CustomerStatus;

  @Column({ name: 'brief_text', type: 'text', nullable: true })
  briefText?: string | null;

  @Column({ name: 'requirements_json', type: 'json', nullable: true })
  requirementsJson?: Record<string, unknown> | null;

  @Column({ name: 'owner_user_id', type: 'varchar', length: 36, nullable: true })
  ownerUserId?: string | null;

  @Column({ name: 'default_team_id', type: 'varchar', length: 36, nullable: true })
  defaultTeamId?: string | null;

  @Column({ name: 'onboarded_at', type: 'datetime', precision: 6, nullable: true })
  onboardedAt?: Date | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'owner_user_id' })
  owner?: User | null;

  @ManyToOne(() => Team, { nullable: true })
  @JoinColumn({ name: 'default_team_id' })
  defaultTeam?: Team | null;
}
