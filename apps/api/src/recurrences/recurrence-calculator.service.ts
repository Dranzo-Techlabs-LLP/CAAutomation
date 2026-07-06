import { Injectable } from '@nestjs/common';
import { RecurrencePatternType } from './task-recurrence.entity';

@Injectable()
export class RecurrenceCalculatorService {
  dueDateForRun(runAt: Date, generateLeadDays: number): Date {
    const due = new Date(runAt);
    due.setUTCDate(due.getUTCDate() + generateLeadDays);
    return due;
  }

  /**
   * Due date honouring a day-of-month pin (patternExpression "day=N", e.g. GSTR-1
   * due the 11th). Clamps to the month's last day for short months. Falls back to
   * the legacy runAt + leadDays behaviour when the pattern doesn't pin a day, so
   * existing recurrences are unaffected.
   */
  dueDateForRecurrence(runAt: Date, patternExpression: string, generateLeadDays: number): Date {
    const match = /day=(\d{1,2})/.exec(patternExpression ?? '');
    if (match) {
      const requested = Number(match[1]);
      const lastDayOfMonth = new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth() + 1, 0)).getUTCDate();
      const day = Math.min(Math.max(requested, 1), lastDayOfMonth);
      return new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth(), day));
    }
    return this.dueDateForRun(runAt, generateLeadDays);
  }

  nextRunAfter(current: Date, patternType: RecurrencePatternType, patternExpression: string): Date {
    const next = new Date(current);
    if (patternType === RecurrencePatternType.Weekly) {
      next.setUTCDate(next.getUTCDate() + 7);
      return next;
    }
    if (patternType === RecurrencePatternType.Monthly || patternExpression.startsWith('day=')) {
      next.setUTCMonth(next.getUTCMonth() + 1);
      return next;
    }
    if (patternType === RecurrencePatternType.Quarterly) {
      next.setUTCMonth(next.getUTCMonth() + 3);
      return next;
    }
    if (patternType === RecurrencePatternType.Yearly) {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
      return next;
    }
    next.setUTCDate(next.getUTCDate() + 1);
    return next;
  }

  preview(start: Date, patternType: RecurrencePatternType, patternExpression: string, leadDays: number): Date[] {
    const occurrences: Date[] = [];
    let runAt = new Date(start);
    for (let index = 0; index < 6; index += 1) {
      occurrences.push(this.dueDateForRecurrence(runAt, patternExpression, leadDays));
      runAt = this.nextRunAfter(runAt, patternType, patternExpression);
    }
    return occurrences;
  }
}
