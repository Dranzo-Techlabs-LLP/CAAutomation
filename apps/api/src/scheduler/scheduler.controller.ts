import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SchedulerStatusService } from './scheduler-status.service';

@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/scheduler')
export class SchedulerController {
  constructor(private readonly status: SchedulerStatusService) {}

  @Get('status')
  @Permissions('scheduler.view')
  getStatus() {
    // In-process timer scheduler — no external queue, so depth is always 0.
    return this.status.snapshot(0);
  }
}
