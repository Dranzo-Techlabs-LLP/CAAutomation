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

  @Column({ name: 'state_code', type: 'varchar', length: 5, nullable: true })
  stateCode?: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl?: string | null;

  @Column({ name: 'signature_url', type: 'varchar', length: 500, nullable: true })
  signatureUrl?: string | null;

  @Column({ name: 'signatory_name', type: 'varchar', length: 120, nullable: true })
  signatoryName?: string | null;

  @Column({ name: 'signatory_designation', type: 'varchar', length: 120, nullable: true })
  signatoryDesignation?: string | null;

  @Column({ name: 'settings_json', type: 'json', nullable: true })
  settingsJson?: Record<string, unknown> | null;
}
