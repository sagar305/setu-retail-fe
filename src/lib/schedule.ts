import type { Chore, Recurrence } from '@/types';
import {
  DateKey,
  addDays,
  dayOfMonth,
  dayOfWeek,
  daysBetween,
  monthsBetween,
  weekdayLabel,
  weeksBetween,
} from './dates';

/** Does `chore` have an occurrence on `date`? */
export function isDueOn(chore: Chore, date: DateKey): boolean {
  if (chore.archived) return false;
  if (daysBetween(chore.startDate, date) < 0) return false;

  const { type, interval, daysOfWeek } = chore.recurrence;
  const every = Math.max(1, interval);

  switch (type) {
    case 'once':
      return chore.startDate === date;

    case 'daily':
      return daysBetween(chore.startDate, date) % every === 0;

    case 'weekly': {
      const days = daysOfWeek?.length ? daysOfWeek : [dayOfWeek(chore.startDate)];
      if (!days.includes(dayOfWeek(date))) return false;
      return weeksBetween(chore.startDate, date) % every === 0;
    }

    case 'monthly': {
      if (dayOfMonth(date) !== dayOfMonth(chore.startDate)) return false;
      return monthsBetween(chore.startDate, date) % every === 0;
    }

    default:
      return false;
  }
}

/** Every occurrence of `chore` in [from, to], inclusive. */
export function occurrencesBetween(chore: Chore, from: DateKey, to: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  for (let cursor = from; daysBetween(cursor, to) >= 0; cursor = addDays(cursor, 1)) {
    if (isDueOn(chore, cursor)) dates.push(cursor);
  }
  return dates;
}

/**
 * The next occurrence on or after `from`. Scans a bounded window so a chore
 * that can never recur again (a past one-off) returns undefined instead of
 * looping forever.
 */
export function nextOccurrence(
  chore: Chore,
  from: DateKey,
  lookaheadDays = 366,
): DateKey | undefined {
  for (let i = 0; i <= lookaheadDays; i += 1) {
    const date = addDays(from, i);
    if (isDueOn(chore, date)) return date;
  }
  return undefined;
}

/** Human-readable summary, e.g. "Every 2 weeks on Mon, Thu". */
export function describeRecurrence(recurrence: Recurrence): string {
  const { type, interval, daysOfWeek } = recurrence;
  const every = Math.max(1, interval);

  switch (type) {
    case 'once':
      return 'One-off';

    case 'daily':
      return every === 1 ? 'Every day' : `Every ${every} days`;

    case 'weekly': {
      const prefix = every === 1 ? 'Weekly' : `Every ${every} weeks`;
      if (!daysOfWeek?.length) return prefix;
      const labels = [...daysOfWeek].sort((a, b) => a - b).map(weekdayLabel).join(', ');
      return `${prefix} on ${labels}`;
    }

    case 'monthly':
      return every === 1 ? 'Every month' : `Every ${every} months`;

    default:
      return '';
  }
}
