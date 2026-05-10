import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { AuditLog } from './audit-log.entity';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Permissions('audit.view')
  list(@CurrentUser() user: RequestUser): Promise<AuditLog[]> {
    return this.auditService.list(user.firmId);
  }

  // Per-entity history (e.g. task timeline). Anyone with task.view can read.
  @Get('entity/:entityType/:entityId')
  @Permissions('task.view')
  forEntity(
    @CurrentUser() user: RequestUser,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
  ): Promise<AuditLog[]> {
    return this.auditService.listForEntity(user.firmId, entityType, entityId, limit ? Math.min(Number(limit), 500) : 200);
  }
}
