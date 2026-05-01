import { Injectable } from '@nestjs/common';
import { RecurrencePatternType } from './task-recurrence.entity';

@Injectable()
export class RecurrenceCalculatorService {
  dueDateForRun(runAt: Date, generateLeadDays: number): Date {
    const due = new Date(runAt);
    due.setUTCDate(due.getUTCDate() + generateLeadDays);
    return due;
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
      occurrences.push(this.dueDateForRun(runAt, leadDays));
      runAt = this.nextRunAfter(runAt, patternType, patternExpression);
    }
    return occurrences;
  }
}
