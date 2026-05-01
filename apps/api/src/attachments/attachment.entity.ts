import { Column, Entity, Index } from 'typeorm';
import { TenantAuditColumns } from '../common/entities/tenant-audit-columns';

export enum AttachmentEntityType {
  Task = 'task',
  Customer = 'customer',
  Invoice = 'invoice',
  Enquiry = 'enquiry',
}

export enum AttachmentTag {
  Evidence = 'evidence',
  Proposal = 'proposal',
  SignedDoc = 'signed_doc',
  Other = 'other',
}

@Entity({ name: 'attachments' })
@Index(['firmId', 'entityType', 'entityId'])
export class Attachment extends TenantAuditColumns {
  @Column({ name: 'entity_type', type: 'enum', enum: AttachmentEntityType })
  entityType!: AttachmentEntityType;

  @Column({ name: 'entity_id', type: 'varchar', length: 36 })
  entityId!: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl!: string;

  @Column({ name: 'mime_type', type: 'varchar', length: 120 })
  mimeType!: string;

  @Column({ name: 'size_bytes', type: 'bigint' })
  sizeBytes!: string;

  @Column({ name: 'uploaded_by_user_id', type: 'varchar', length: 36 })
  uploadedByUserId!: string;

  @Column({ type: 'enum', enum: AttachmentTag, default: AttachmentTag.Other })
  tag!: AttachmentTag;
}
