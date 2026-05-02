import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/notification.entity';
import { Task } from '../tasks/task.entity';
import { WorkflowsModule } from '../workflows/workflows.module';
import { ActionExecutorService } from './action-executor.service';
import { AutomationRule } from './automation-rule.entity';
import { AutomationRulesController } from './automation-rules.controller';
import { AutomationRulesService } from './automation-rules.service';
import { TaskLifecycleService } from './task-lifecycle.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationRule, Task, Notification]),
    forwardRef(() => WorkflowsModule),
  ],
  controllers: [AutomationRulesController],
  providers: [AutomationRulesService, ActionExecutorService, TaskLifecycleService],
  exports: [AutomationRulesService, ActionExecutorService, TaskLifecycleService],
})
export class AutomationRulesModule {}
