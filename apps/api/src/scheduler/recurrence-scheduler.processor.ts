import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { SchedulerStatusService } from './scheduler-status.service';

@Processor('recurrence-scheduler')
export class RecurrenceSchedulerProcessor extends WorkerHost {
  constructor(
    private readonly recurrencesService: RecurrencesService,
    private readonly schedulerStatus: SchedulerStatusService,
  ) {
    super();
  }

  async process(_job: Job): Promise<void> {
    try {
      this.schedulerStatus.markTick();
      await this.recurrencesService.runDue();
    } catch (error) {
      this.schedulerStatus.markFailure(error);
      throw error;
    }
  }
}
