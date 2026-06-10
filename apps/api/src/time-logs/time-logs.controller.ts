import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateTimeLogDto } from './dto/create-time-log.dto';
import { UpdateTimeLogDto } from './dto/update-time-log.dto';
import { TimeLog } from './time-log.entity';
import { TimeLogsService } from './time-logs.service';

@ApiTags('Time Logs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('time-logs')
export class TimeLogsController {
  constructor(private readonly timeLogsService: TimeLogsService) {}

  @Post()
  @Permissions('time_log.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTimeLogDto): Promise<TimeLog> {
    return this.timeLogsService.create(user.firmId, dto, user.id);
  }

  @Get('task/:taskId')
  @Permissions('time_log.view')
  async listForTask(@CurrentUser() user: RequestUser, @Param('taskId') taskId: string): Promise<TimeLog[]> {
    return this.timeLogsService.listForTask(user.firmId, taskId);
  }

  // Correct a wrong entry (double-save, wrong hours). Own entries only,
  // unless the actor holds task.edit (supervisor correction).
  @Patch(':id')
  @Permissions('time_log.create')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTimeLogDto,
  ): Promise<TimeLog> {
    return this.timeLogsService.update(user.firmId, id, dto, user.id, user.permissions.includes('task.edit'));
  }

  @Delete(':id')
  @Permissions('time_log.create')
  async remove(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ): Promise<{ deleted: true }> {
    return this.timeLogsService.remove(user.firmId, id, user.id, user.permissions.includes('task.edit'));
  }

  @Get('task/:taskId/rollup')
  @Permissions('time_log.view')
  async rollupForTask(@CurrentUser() user: RequestUser, @Param('taskId') taskId: string) {
    return this.timeLogsService.rollupForTask(user.firmId, taskId);
  }
}
