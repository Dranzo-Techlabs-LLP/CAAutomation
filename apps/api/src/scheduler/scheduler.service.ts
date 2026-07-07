import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RecurrencesService } from '../recurrences/recurrences.service';
import { SchedulerStatusService } from './scheduler-status.service';

/**
 * In-process recurrence scheduler. Runs entirely inside the Node process on a timer —
 * no Redis / BullMQ required — so recurring tasks generate on any host. Disabled when
 * DISABLE_SCHEDULER=true. Safe under multiple instances: runOne() has duplicate/overlap
 * guards, so a double run just skips.
 */
@Injectable()
export class SchedulerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly intervalMs = 60 * 60 * 1000; // scan hourly

  constructor(
    private readonly config: ConfigService,
    private readonly recurrences: RecurrencesService,
    private readonly status: SchedulerStatusService,
  ) {}

  onApplicationBootstrap(): void {
    if (this.config.get<string>('DISABLE_SCHEDULER') === 'true') {
      this.logger.log('Recurrence scheduler disabled (DISABLE_SCHEDULER=true)');
      return;
    }
    // First scan shortly after boot (catch anything already due), then hourly.
    setTimeout(() => void this.tick(), 30_000);
    this.timer = setInterval(() => void this.tick(), this.intervalMs);
    this.logger.log('Recurrence scheduler started (in-process, hourly)');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Generate any recurrence tasks that are now due. Never overlaps with itself. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      this.status.markTick();
      await this.recurrences.runDue();
    } catch (error) {
      this.status.markFailure(error);
      this.logger.error(`Recurrence scan failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.running = false;
    }
  }
}
