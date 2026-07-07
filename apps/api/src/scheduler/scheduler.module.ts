import { Module } from '@nestjs/common';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SchedulerStatusService } from './scheduler-status.service';

@Module({
  imports: [RecurrencesModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerStatusService],
})
export class SchedulerModule {}
