import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasksModule } from '../tasks/tasks.module';
import { TaskStepHistory } from './task-step-history.entity';
import { WorkflowStepTransition } from './workflow-step-transition.entity';
import { WorkflowStep } from './workflow-step.entity';
import { Workflow } from './workflow.entity';
import { WorkflowsController } from './workflows.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Workflow, WorkflowStep, WorkflowStepTransition, TaskStepHistory]),
    TasksModule,
  ],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService, TypeOrmModule],
})
export class WorkflowsModule {}
