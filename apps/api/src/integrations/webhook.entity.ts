import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

@Entity({ name: 'webhooks' })
@Index(['firmId', 'isActive'])
export class Webhook extends TenantAuditColumns {
  @Column({ type: 'varchar', length: 500 })
  url!: string;

  @Column({ name: 'events_json', type: 'json' })
  eventsJson!: string[];

  @Column({ type: 'varchar', length: 255 })
  secret!: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
