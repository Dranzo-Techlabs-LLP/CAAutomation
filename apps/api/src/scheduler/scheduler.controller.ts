import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { SchedulerStatusService } from './scheduler-status.service';
import { SchedulerService } from './scheduler.service';

@ApiTags('Scheduler')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('admin/scheduler')
export class SchedulerController {
  constructor(
    private readonly scheduler: SchedulerService,
    private readonly status: SchedulerStatusService,
  ) {}

  @Get('status')
  @Permissions('scheduler.view')
  async getStatus() {
    return this.status.snapshot(await this.scheduler.depth());
  }
}
