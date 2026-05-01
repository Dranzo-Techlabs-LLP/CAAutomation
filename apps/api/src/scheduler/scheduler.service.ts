import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

@Injectable()
export class SchedulerService implements OnModuleInit {
  constructor(
    @InjectQueue('recurrence-scheduler')
    private readonly queue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.queue.add('hourly-recurrence-scan', {}, { repeat: { pattern: '0 * * * *' }, removeOnComplete: true });
    await this.queue.add('nightly-recurrence-master', {}, { repeat: { pattern: '0 30 19 * * *' }, removeOnComplete: true });
  }

  async depth(): Promise<number> {
    return this.queue.count();
  }
}
