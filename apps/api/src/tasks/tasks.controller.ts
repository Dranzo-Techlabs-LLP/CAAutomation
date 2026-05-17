import { Body, Controller, Delete, Get, Inject, Optional, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TaskLifecycleService } from '../automation-rules/task-lifecycle.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskResponseDto } from './dto/task-response.dto';
import { UpdateTaskResolutionDto } from './dto/update-task-resolution.dto';
import { UpdateTaskStatusDto } from './dto/update-task-status.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tasks')
export class TasksController {
  constructor(
    private readonly tasksService: TasksService,
    @Optional() @Inject(TaskLifecycleService) private readonly lifecycle?: TaskLifecycleService,
  ) {}

  @Get()
  @Permissions('task.view')
  async list(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TaskResponseDto>> {
    // Users without `task.view_all` see only tasks assigned to them.
    const restrictToUserId = user.permissions.includes('task.view_all') ? null : user.id;
    return this.tasksService.list(user.firmId, query, { restrictToUserId });
  }

  @Get('my')
  async myTickets(
    @CurrentUser() user: RequestUser,
    @Query() query: PaginationQueryDto,
  ): Promise<PaginatedResponseDto<TaskResponseDto>> {
    return this.tasksService.listAssignedToUser(user.firmId, user.id, query);
  }

  @Post()
  @Permissions('task.create')
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateTaskDto): Promise<TaskResponseDto> {
    const result = await this.tasksService.create(user.firmId, dto, user.id);
    this.lifecycle?.onTaskCreated(result.id, user.firmId, user.id);
    return result;
  }

  @Patch(':id')
  @Permissions('task.edit')
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ): Promise<TaskResponseDto> {
    return this.tasksService.update(user.firmId, id, dto, user.id);
  }

  @Patch(':id/status')
  @Permissions('task.edit')
  async updateStatus(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskStatusDto,
  ): Promise<TaskResponseDto> {
    const result = await this.tasksService.updateStatus(user.firmId, id, dto.status, user.id);
    this.lifecycle?.onTaskStatusChanged(result.id, user.firmId, user.id);
    return result;
  }

  @Delete(':id')
  @Permissions('task.edit')
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<{ deleted: boolean }> {
    await this.tasksService.delete(user.firmId, id);
    return { deleted: true };
  }

  @Patch(':id/resolution')
  async updateResolution(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() dto: UpdateTaskResolutionDto,
  ): Promise<TaskResponseDto> {
    const result = await this.tasksService.updateResolution(user.firmId, id, dto, user.id);
    this.lifecycle?.onTaskResolutionAdded(result.id, user.firmId, user.id);
    return result;
  }

  // ── Subtasks ────────────────────────────────────────────────────────────
  @Get(':id/subtasks')
  @Permissions('task.view')
  async listSubtasks(@CurrentUser() user: RequestUser, @Param('id') id: string): Promise<TaskResponseDto[]> {
    return this.tasksService.listSubtasks(user.firmId, id);
  }

  @Post(':id/subtasks')
  @Permissions('task.create')
  async createSubtask(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { title: string; description?: string; assignedToUserId?: string; dueDate?: string; estimatedHours?: string },
  ): Promise<TaskResponseDto> {
    return this.tasksService.createSubtask(user.firmId, id, body, user.id);
  }

  @Patch(':id/subtasks/reorder')
  @Permissions('task.edit')
  async reorderSubtasks(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { orderedIds: string[] },
  ): Promise<TaskResponseDto[]> {
    return this.tasksService.reorderSubtasks(user.firmId, id, body.orderedIds ?? [], user.id);
  }
}
