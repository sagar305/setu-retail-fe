// Report date ranges in the shop's time zone, sent to the API as UTC instants.

function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
  const m = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return Date.UTC(Number(m.year), Number(m.month) - 1, Number(m.day), Number(m.hour), Number(m.minute), Number(m.second)) - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant a shop-local calendar day starts. */
export function dayStart(day: string, timeZone: string): Date {
  const guess = new Date(`${day}T00:00:00Z`);
  return new Date(guess.getTime() - offsetMs(guess, timeZone));
}

export function shopDay(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export type Preset = "today" | "yesterday" | "7d" | "month" | "custom";
export const PRESETS: { id: Preset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "7d", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];

/** First and last shop day (inclusive) for a preset. */
export function presetDays(preset: Exclude<Preset, "custom">, now: Date, timeZone: string): { first: string; last: string } {
  const today = shopDay(now, timeZone);
  if (preset === "today") return { first: today, last: today };
  if (preset === "yesterday") return { first: addDays(today, -1), last: addDays(today, -1) };
  if (preset === "7d") return { first: addDays(today, -6), last: today };
  return { first: `${today.slice(0, 8)}01`, last: today };
}

/** [from, to) instants covering the shop days first..last. */
export function toRange(first: string, last: string, timeZone: string) {
  return { from: dayStart(first, timeZone).toISOString(), to: dayStart(addDays(last, 1), timeZone).toISOString() };
}
