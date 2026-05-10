import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateTaskStatusDto, ReorderStatusesDto, UpdateTaskStatusEntityDto } from './dto/task-status.dto';
import { TaskStatusEntity } from './task-status.entity';
import { TaskStatusesService } from './task-statuses.service';

@ApiTags('Task Statuses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('task-statuses')
export class TaskStatusesController {
  constructor(private readonly service: TaskStatusesService) {}

  @Get()
  @Permissions('task.view')
  async list(@CurrentUser() user: RequestUser): Promise<TaskStatusEntity[]> {
    return this.service.listForFirm(user.firmId);
  }

  @Post()
  @Permissions('settings.edit')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskStatusDto): Promise<TaskStatusEntity> {
    return this.service.create(user.firmId, dto, user.id);
  }

  @Patch('reorder')
  @Permissions('settings.edit')
  async reorder(@CurrentUser() user: RequestUser, @Body() dto: ReorderStatusesDto): Promise<TaskStatusEntity[]> {
    return this.service.reorder(user.firmId, dto, user.id);
  }

  @Patch(':id')
  @Permissions('settings.edit')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusEntityDto,
  ): Promise<TaskStatusEntity> {
    return this.service.update(user.firmId, id, dto, user.id);
  }

  @Delete(':id')
  @Permissions('settings.edit')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.service.delete(user.firmId, id);
    return { deleted: true };
  }
}
