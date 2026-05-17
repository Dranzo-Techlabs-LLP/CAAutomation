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

  // Users without `report.view_all` are forced to their own userId scope.
  private scopeQuery(user: RequestUser, q: AnalyticsQueryDto): AnalyticsQueryDto {
    if (user.permissions.includes('report.view_all')) return q;
    return { ...q, userId: user.id };
  }

  @Get('overview')
  @Permissions('report.view')
  async overview(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.overview(user.firmId, this.scopeQuery(user, q));
  }

  @Get('staff')
  @Permissions('report.view')
  async staff(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.staff(user.firmId, this.scopeQuery(user, q));
  }

  @Get('clients')
  @Permissions('report.view')
  async clients(@CurrentUser() user: RequestUser, @Query() q: AnalyticsQueryDto) {
    return this.service.clients(user.firmId, this.scopeQuery(user, q));
  }
}
