/**
 * Dates are handled as `YYYY-MM-DD` strings so that a chore due "today"
 * means the same thing regardless of timezone or DST. All arithmetic goes
 * through UTC to keep day counts exact.
 */
import { MONTH_LABELS, WEEKDAY_LABELS, strings } from '@/i18n/strings';
import type { DateKey, TimeKey } from '@/types';

export type { DateKey, TimeKey };

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayKey(): DateKey {
  return toDateKey(new Date());
}

function parts(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m, d];
}

/** Midnight UTC for the given key — a stable anchor for day maths. */
function toUtc(key: DateKey): Date {
  const [y, m, d] = parts(key);
  return new Date(Date.UTC(y, m - 1, d));
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = toUtc(key);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Adds calendar months, clamping to the end of the target month. 31 Jan plus
 * one month is 28 Feb, not 3 March — UTC date arithmetic would otherwise roll
 * the overflow into the following month.
 */
export function addMonths(key: DateKey, months: number): DateKey {
  const [y, m, d] = parts(key);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const daysInTargetMonth = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();

  target.setUTCDate(Math.min(d, daysInTargetMonth));
  return target.toISOString().slice(0, 10);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const ms = toUtc(to).getTime() - toUtc(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function monthsBetween(from: DateKey, to: DateKey): number {
  const [fy, fm] = parts(from);
  const [ty, tm] = parts(to);
  return (ty - fy) * 12 + (tm - fm);
}

/** 0 = Sunday ... 6 = Saturday. */
export function dayOfWeek(key: DateKey): number {
  return toUtc(key).getUTCDay();
}

export function dayOfMonth(key: DateKey): number {
  return parts(key)[2];
}

/** Days since the most recent Sunday — used to align weekly intervals. */
function startOfWeek(key: DateKey): DateKey {
  return addDays(key, -dayOfWeek(key));
}

export function weeksBetween(from: DateKey, to: DateKey): number {
  return Math.round(daysBetween(startOfWeek(from), startOfWeek(to)) / 7);
}

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index] ?? '';
}

/** "Aaj", "Kal", "Beeta kal", or e.g. "Som, 4 Sep". */
export function formatRelativeDay(key: DateKey, reference: DateKey = todayKey()): string {
  const diff = daysBetween(reference, key);
  if (diff === 0) return strings.days.today;
  if (diff === 1) return strings.days.tomorrow;
  if (diff === -1) return strings.days.yesterday;
  return formatDay(key);
}

/** e.g. "Som, 4 Sep". */
export function formatDay(key: DateKey): string {
  const [, m, d] = parts(key);
  return `${weekdayLabel(dayOfWeek(key))}, ${d} ${MONTH_LABELS[m - 1]}`;
}

/** Combines a day and an HH:MM time into a real Date in the device's timezone. */
export function toLocalDateTime(key: DateKey, time: TimeKey): Date {
  const [y, m, d] = parts(key);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hour, minute, 0, 0);
}

/** Formats HH:MM as a 12-hour label, e.g. "9:05 AM". */
export function formatTime(time: TimeKey): string {
  const [hour, minute] = time.split(':').map(Number);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${`${minute}`.padStart(2, '0')} ${suffix}`;
}
