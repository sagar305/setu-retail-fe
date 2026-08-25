/**
 * Dates are handled as `YYYY-MM-DD` strings so that a chore due "today"
 * means the same thing regardless of timezone or DST. All arithmetic goes
 * through UTC to keep day counts exact.
 */
export type DateKey = string;

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

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function weekdayLabel(index: number): string {
  return WEEKDAY_LABELS[index] ?? '';
}

/** "Today", "Tomorrow", "Yesterday", or e.g. "Mon, 4 Sep". */
export function formatRelativeDay(key: DateKey, reference: DateKey = todayKey()): string {
  const diff = daysBetween(reference, key);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff === -1) return 'Yesterday';
  return formatDay(key);
}

/** e.g. "Mon, 4 Sep". */
export function formatDay(key: DateKey): string {
  const [, m, d] = parts(key);
  return `${weekdayLabel(dayOfWeek(key))}, ${d} ${MONTH_LABELS[m - 1]}`;
}
