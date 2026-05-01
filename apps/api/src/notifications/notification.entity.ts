import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'notifications' })
@Index(['firmId', 'userId', 'readAt'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'firm_id', type: 'varchar', length: 36 })
  firmId!: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId!: string;

  @Column({ type: 'varchar', length: 80 })
  type!: string;

  @Column({ name: 'payload_json', type: 'json' })
  payloadJson!: Record<string, unknown>;

  @Column({ name: 'read_at', type: 'datetime', precision: 6, nullable: true })
  readAt?: Date | null;

  @Column({ name: 'created_at', type: 'datetime', precision: 6, default: () => 'CURRENT_TIMESTAMP(6)' })
  createdAt!: Date;
}
