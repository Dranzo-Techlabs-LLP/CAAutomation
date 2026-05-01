import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';
import { User } from '../users/user.entity';
import { Team } from './team.entity';

export enum TeamRole {
  Lead = 'lead',
  Member = 'member',
  Reviewer = 'reviewer',
}

@Entity({ name: 'team_members' })
@Index(['teamId', 'userId'], { unique: true })
export class TeamMember extends TenantAuditColumns {
  @Column({ name: 'team_id', type: 'varchar', length: 36 })
  teamId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ name: 'role_in_team', type: 'enum', enum: TeamRole, default: TeamRole.Member })
  roleInTeam!: TeamRole;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ name: 'joined_at', type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  joinedAt!: Date;

  @ManyToOne(() => Team, (team) => team.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'team_id' })
  team!: Team;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
