import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { AuditColumns } from '../common/entities/audit-columns';
import { User } from '../users/user.entity';

@Entity({ name: 'password_reset_tokens' })
export class PasswordResetToken extends AuditColumns {
  @Index()
  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Index({ unique: true })
  @Column({ name: 'token_hash', type: 'varchar', length: 255 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'datetime', precision: 6, nullable: true })
  usedAt?: Date | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
