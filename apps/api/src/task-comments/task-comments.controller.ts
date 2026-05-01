import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequestUser } from '../common/types/request-user';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TaskComment } from './task-comment.entity';
import { TaskCommentsService } from './task-comments.service';

@ApiTags('Task Comments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('tasks/:taskId/comments')
export class TaskCommentsController {
  constructor(private readonly taskCommentsService: TaskCommentsService) {}

  @Get()
  @Permissions('task.view')
  async list(@CurrentUser() user: RequestUser, @Param('taskId') taskId: string): Promise<TaskComment[]> {
    return this.taskCommentsService.list(user.firmId, taskId);
  }

  @Post()
  @Permissions('task.comment')
  async create(
    @CurrentUser() user: RequestUser,
    @Param('taskId') taskId: string,
    @Body() dto: CreateTaskCommentDto,
  ): Promise<TaskComment> {
    return this.taskCommentsService.create(user.firmId, taskId, dto, user.id);
  }
}
