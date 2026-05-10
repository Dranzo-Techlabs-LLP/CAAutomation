import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRulesModule } from '../automation-rules/automation-rules.module';
import { ServiceSubtaskTemplate } from '../services-catalog/service-subtask-template.entity';
import { Task } from './task.entity';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Task, ServiceSubtaskTemplate]),
    forwardRef(() => AutomationRulesModule),
  ],
  controllers: [TasksController],
  providers: [TasksService],
  exports: [TasksService, TypeOrmModule],
})
export class TasksModule {}
