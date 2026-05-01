import { Column, Index } from 'typeorm';
import { AuditColumns } from './audit-columns';

export abstract class TenantAuditColumns extends AuditColumns {
  @Index()
  @Column({ name: 'firm_id', type: 'varchar', length: 36 })
  firmId!: string;
}
