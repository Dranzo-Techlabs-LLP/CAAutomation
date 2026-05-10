import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { ReportQueryDto } from './dto/report-query.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('staff')
  @Permissions('report.view')
  async staff(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.staffReport(user.firmId, query);
  }

  @Get('client')
  @Permissions('report.view')
  async client(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.clientReport(user.firmId, query);
  }

  @Get('work-logs')
  @Permissions('report.view')
  async workLogs(@CurrentUser() user: RequestUser, @Query() query: ReportQueryDto) {
    return this.reportsService.workLogs(user.firmId, query);
  }
}
