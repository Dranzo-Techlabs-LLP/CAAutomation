import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TaskStatusEntity } from './task-status.entity';
import { TaskStatusesController } from './task-statuses.controller';
import { TaskStatusesService } from './task-statuses.service';

@Module({
  imports: [TypeOrmModule.forFeature([TaskStatusEntity])],
  controllers: [TaskStatusesController],
  providers: [TaskStatusesService],
  exports: [TaskStatusesService, TypeOrmModule],
})
export class TaskStatusesModule {}
