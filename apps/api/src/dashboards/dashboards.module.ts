import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Invoice } from '../billing/invoice.entity';
import { TaskRecurrence } from '../recurrences/task-recurrence.entity';
import { Task } from '../tasks/task.entity';
import { TimeLog } from '../time-logs/time-log.entity';
import { DashboardsController } from './dashboards.controller';
import { DashboardsService } from './dashboards.service';

@Module({
  imports: [TypeOrmModule.forFeature([Task, Invoice, TimeLog, TaskRecurrence])],
  controllers: [DashboardsController],
  providers: [DashboardsService],
})
export class DashboardsModule {}
