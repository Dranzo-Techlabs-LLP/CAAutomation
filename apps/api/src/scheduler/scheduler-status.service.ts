import { Injectable } from '@nestjs/common';

@Injectable()
export class SchedulerStatusService {
  private lastTickAt?: Date;
  private recentFailures: Array<{ at: string; message: string }> = [];

  markTick(): void {
    this.lastTickAt = new Date();
  }

  markFailure(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown scheduler failure';
    this.recentFailures.unshift({ at: new Date().toISOString(), message });
    this.recentFailures = this.recentFailures.slice(0, 20);
  }

  snapshot(queueDepth: number): { lastTickAt?: string; queueDepth: number; recentFailures: Array<{ at: string; message: string }> } {
    return {
      lastTickAt: this.lastTickAt?.toISOString(),
      queueDepth,
      recentFailures: this.recentFailures,
    };
  }
}
