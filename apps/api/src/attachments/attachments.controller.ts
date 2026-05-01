import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { Attachment } from './attachment.entity';
import { AttachmentsService } from './attachments.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';

@ApiTags('Attachments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @Permissions('attachment.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateAttachmentDto): Promise<Attachment> {
    return this.attachmentsService.create(user.firmId, dto, user.id);
  }

  @Get(':entityType/:entityId')
  @Permissions('attachment.view')
  async listForEntity(
    @CurrentUser() user: RequestUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ): Promise<Attachment[]> {
    return this.attachmentsService.listForEntity(user.firmId, entityType, entityId);
  }
}
