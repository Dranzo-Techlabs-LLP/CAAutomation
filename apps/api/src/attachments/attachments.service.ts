import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Attachment } from './attachment.entity';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectRepository(Attachment)
    private readonly attachmentRepository: Repository<Attachment>,
  ) {}

  async create(firmId: string, dto: CreateAttachmentDto, actorUserId: string): Promise<Attachment> {
    return this.attachmentRepository.save(
      this.attachmentRepository.create({
        ...dto,
        firmId,
        uploadedByUserId: actorUserId,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async listForEntity(firmId: string, entityType: string, entityId: string): Promise<Attachment[]> {
    return this.attachmentRepository.find({
      where: { firmId, entityType: entityType as Attachment['entityType'], entityId },
      order: { createdAt: 'DESC' },
    });
  }
}
