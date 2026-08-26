import { strings } from '@/i18n/strings';
import type { Chore, Recurrence, SnoozeSetting } from '@/types';
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

/** Mon–Sat. Sunday is the only non-working day. */
const WORKING_DAYS = [1, 2, 3, 4, 5, 6];
const SUNDAY = 0;

/** Does `chore` have an occurrence on `date`? */
export function isDueOn(chore: Chore, date: DateKey): boolean {
  if (chore.archived) return false;
  if (daysBetween(chore.startDate, date) < 0) return false;
  return matchesRecurrence(chore.recurrence, chore.startDate, date);
}

function matchesRecurrence(recurrence: Recurrence, startDate: DateKey, date: DateKey): boolean {
  const { preset, weekday, custom } = recurrence;

  switch (preset) {
    case 'once':
      return startDate === date;

    case 'daily':
      return true;

    case 'alternate':
      return daysBetween(startDate, date) % 2 === 0;

    case 'weekday':
      return WORKING_DAYS.includes(dayOfWeek(date));

    case 'sunday':
      return dayOfWeek(date) === SUNDAY;

    // Every 4 weeks on the chosen weekday.
    case 'monthly':
      return onWeekdayEveryNWeeks(startDate, date, weekday ?? dayOfWeek(startDate), 4);

    // Every 2 weeks on the chosen weekday.
    case 'twiceMonthly':
      return onWeekdayEveryNWeeks(startDate, date, weekday ?? dayOfWeek(startDate), 2);

    case 'alternateSunday':
      return onWeekdayEveryNWeeks(startDate, date, SUNDAY, 2);

    case 'custom':
      return custom ? matchesCustom(custom, startDate, date) : false;

    default:
      return false;
  }
}

/** The first occurrence of `weekday` on or after `startDate`. */
function firstWeekdayOnOrAfter(startDate: DateKey, weekday: number): DateKey {
  const offset = (weekday - dayOfWeek(startDate) + 7) % 7;
  return addDays(startDate, offset);
}

function onWeekdayEveryNWeeks(
  startDate: DateKey,
  date: DateKey,
  weekday: number,
  everyNWeeks: number,
): boolean {
  if (dayOfWeek(date) !== weekday) return false;

  // Count cycles from the chore's first real occurrence, not from the calendar
  // week containing the start date — otherwise a chore started on Monday that
  // repeats on Sundays would skip its own first Sunday.
  const anchor = firstWeekdayOnOrAfter(startDate, weekday);
  const weeks = daysBetween(anchor, date) / 7;
  if (weeks < 0) return false;
  return weeks % everyNWeeks === 0;
}

function matchesCustom(custom: NonNullable<Recurrence['custom']>, startDate: DateKey, date: DateKey) {
  const every = Math.max(1, custom.interval);

  switch (custom.unit) {
    case 'day':
      return daysBetween(startDate, date) % every === 0;

    case 'week': {
      const days = custom.daysOfWeek?.length ? custom.daysOfWeek : [dayOfWeek(startDate)];
      if (!days.includes(dayOfWeek(date))) return false;
      return weeksBetween(startDate, date) % every === 0;
    }

    case 'month': {
      const dates = custom.datesOfMonth?.length ? custom.datesOfMonth : [dayOfMonth(startDate)];
      if (!dates.includes(dayOfMonth(date))) return false;
      return monthsBetween(startDate, date) % every === 0;
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

/** Human-readable summary of a recurrence, in Hinglish. */
export function describeRecurrence(recurrence: Recurrence): string {
  const { preset, weekday, custom } = recurrence;

  if (preset === 'monthly' || preset === 'twiceMonthly') {
    const base = strings.frequency[preset];
    return weekday === undefined ? base : `${base}, ${weekdayLabel(weekday)}`;
  }

  if (preset === 'custom') {
    if (!custom) return strings.frequency.custom;
    const every = Math.max(1, custom.interval);
    const unitLabel = strings.units[custom.unit === 'day' ? 'day' : custom.unit];
    const prefix = every === 1 ? `Har ${unitLabel.toLowerCase()}` : `Har ${every} ${unitLabel.toLowerCase()}`;

    if (custom.unit === 'week' && custom.daysOfWeek?.length) {
      const labels = [...custom.daysOfWeek].sort((a, b) => a - b).map(weekdayLabel).join(', ');
      return `${prefix}, ${labels}`;
    }
    if (custom.unit === 'month' && custom.datesOfMonth?.length) {
      const labels = [...custom.datesOfMonth].sort((a, b) => a - b).join(', ');
      return `${prefix}, tareekh ${labels}`;
    }
    return prefix;
  }

  return strings.frequency[preset];
}

/** How long a snooze defers the reminder, in minutes. */
export function snoozeMinutes(setting: SnoozeSetting): number {
  switch (setting.preset) {
    case '6h':
      return 6 * 60;
    case '12h':
      return 12 * 60;
    case '1d':
      return 24 * 60;
    case '1w':
      return 7 * 24 * 60;
    case 'custom': {
      const amount = Math.max(1, setting.customAmount ?? 1);
      return setting.customUnit === 'day' ? amount * 24 * 60 : amount * 60;
    }
    default:
      return 60;
  }
}

/** Hinglish label for a snooze setting, e.g. "3 ghante baad". */
export function describeSnooze(setting: SnoozeSetting): string {
  if (setting.preset !== 'custom') return strings.snooze[setting.preset];
  const amount = Math.max(1, setting.customAmount ?? 1);
  return setting.customUnit === 'day' ? `${amount} din baad` : `${amount} ghante baad`;
}
