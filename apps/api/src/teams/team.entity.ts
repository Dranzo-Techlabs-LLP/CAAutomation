import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { User } from '../users/user.entity';
import { TeamMember } from './team-member.entity';

@Entity({ name: 'teams' })
@Index(['firmId', 'name'], { unique: true })
export class Team extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 120 })
  name!: string;

  @Column({ type: 'text', nullable: true })
  description?: string | null;

  @Column({ name: 'lead_user_id', type: 'varchar', length: 36, nullable: true })
  leadUserId?: string | null;

  @Column({ name: 'last_assigned_user_id', type: 'varchar', length: 36, nullable: true })
  lastAssignedUserId?: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'lead_user_id' })
  leadUser?: User | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'last_assigned_user_id' })
  lastAssignedUser?: User | null;

  @OneToMany(() => TeamMember, (teamMember) => teamMember.team)
  members!: TeamMember[];
}
