import { Column, Entity, Index } from 'typeorm';
import { AuditColumns } from './audit-columns';

@Entity({ name: 'firms' })
export class Firm extends AuditColumns {
  @Column({ type: 'varchar', length: 180 })
  name!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin?: string | null;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 10, nullable: true })
  pan?: string | null;

  @Column({ type: 'text', nullable: true })
  address?: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'settings_json', type: 'json', nullable: true })
  settingsJson?: Record<string, unknown> | null;
}
