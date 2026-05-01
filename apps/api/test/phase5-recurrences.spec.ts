import { RecurrenceCalculatorService } from '../src/recurrences/recurrence-calculator.service';
import { RecurrencePatternType } from '../src/recurrences/task-recurrence.entity';

describe('Phase 5 recurrence scheduler behavior', () => {
  const calculator = new RecurrenceCalculatorService();

  it('creates the materialized due date using lead days', () => {
    const runAt = new Date('2026-05-15T00:00:00.000Z');
    expect(calculator.dueDateForRun(runAt, 5).toISOString()).toBe('2026-05-20T00:00:00.000Z');
  });

  it('advances monthly recurrences without duplicate run timestamps', () => {
    const first = new Date('2026-05-15T00:00:00.000Z');
    const second = calculator.nextRunAfter(first, RecurrencePatternType.Monthly, 'day=20');
    expect(second.toISOString()).toBe('2026-06-15T00:00:00.000Z');
  });

  it('previews the next six occurrences', () => {
    const preview = calculator.preview(
      new Date('2026-05-15T00:00:00.000Z'),
      RecurrencePatternType.Weekly,
      'weekday=friday',
      2,
    );
    expect(preview).toHaveLength(6);
    expect(preview[0].toISOString()).toBe('2026-05-17T00:00:00.000Z');
    expect(preview[1].toISOString()).toBe('2026-05-24T00:00:00.000Z');
  });
});
