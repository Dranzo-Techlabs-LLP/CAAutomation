import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { RecurrencesModule } from '../recurrences/recurrences.module';
import { RecurrenceSchedulerProcessor } from './recurrence-scheduler.processor';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { SchedulerStatusService } from './scheduler-status.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'recurrence-scheduler' }), RecurrencesModule],
  controllers: [SchedulerController],
  providers: [SchedulerService, SchedulerStatusService, RecurrenceSchedulerProcessor],
})
export class SchedulerModule {}
