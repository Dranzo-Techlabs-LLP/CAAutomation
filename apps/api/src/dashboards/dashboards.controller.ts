import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { DashboardsService } from './dashboards.service';

@ApiTags('Dashboards')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Get('partner')
  @Permissions('dashboard.partner')
  partner(@CurrentUser() user: RequestUser) {
    return this.dashboardsService.partner(user.firmId);
  }

  @Get('manager')
  @Permissions('dashboard.manager')
  manager(@CurrentUser() user: RequestUser) {
    return this.dashboardsService.manager(user.firmId);
  }

  @Get('associate')
  @Permissions('dashboard.associate')
  associate(@CurrentUser() user: RequestUser) {
    return this.dashboardsService.associate(user.firmId, user.id);
  }

  @Get('compliance-calendar')
  @Permissions('dashboard.compliance_calendar')
  complianceCalendar(@CurrentUser() user: RequestUser) {
    return this.dashboardsService.complianceCalendar(user.firmId);
  }
}
