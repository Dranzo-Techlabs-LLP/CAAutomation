import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TasksService } from '../tasks/tasks.service';
import { CreateTaskCommentDto } from './dto/create-task-comment.dto';
import { TaskComment } from './task-comment.entity';

@Injectable()
export class TaskCommentsService {
  constructor(
    @InjectRepository(TaskComment)
    private readonly commentRepository: Repository<TaskComment>,
    private readonly tasksService: TasksService,
  ) {}

  async create(
    firmId: string,
    taskId: string,
    dto: CreateTaskCommentDto,
    actorUserId: string,
  ): Promise<TaskComment> {
    await this.tasksService.getEntityOrFail(firmId, taskId);
    return this.commentRepository.save(
      this.commentRepository.create({
        firmId,
        taskId,
        userId: actorUserId,
        body: dto.body,
        mentionsJson: dto.mentionUserIds,
        createdBy: actorUserId,
        updatedBy: actorUserId,
      }),
    );
  }

  async list(firmId: string, taskId: string): Promise<TaskComment[]> {
    await this.tasksService.getEntityOrFail(firmId, taskId);
    return this.commentRepository.find({
      where: { firmId, taskId },
      order: { createdAt: 'ASC' },
    });
  }
}
