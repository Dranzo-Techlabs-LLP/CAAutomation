import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Get('overview')
  @Permissions('report.view')
  async overview(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.overview(user.firmId, q);
  }

  @Get('staff')
  @Permissions('report.view')
  async staff(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.staff(user.firmId, q);
  }

  @Get('clients')
  @Permissions('report.view')
  async clients(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.clients(user.firmId, q);
  }
}
