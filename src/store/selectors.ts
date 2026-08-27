import { DateKey, addDays, daysBetween } from '@/lib/dates';
import { isDueOn } from '@/lib/schedule';
import type { AppData, ChoreOccurrence, Member, OccurrenceStatus } from '@/types';

/** How far back "overdue" looks. Older misses drop off rather than pile up. */
const OVERDUE_WINDOW_DAYS = 14;

function findMember(data: AppData, id?: string | null): Member | undefined {
  if (!id) return undefined;
  return data.members.find((m) => m.id === id);
}

function buildOccurrence(
  data: AppData,
  choreId: string,
  dueDate: DateKey,
  today: DateKey,
): ChoreOccurrence | undefined {
  const chore = data.chores.find((c) => c.id === choreId);
  if (!chore) return undefined;

  const matches = <T extends { choreId: string; dueDate: string }>(item: T) =>
    item.choreId === choreId && item.dueDate === dueDate;

  const completion = data.completions.find(matches);
  const skip = data.skips.find(matches);
  const snooze = data.snoozes.find(matches);

  const status: OccurrenceStatus = completion ? 'done' : skip ? 'skipped' : 'pending';

  return {
    chore,
    dueDate,
    assignee: findMember(data, chore.assigneeId),
    completion,
    skip,
    snooze,
    status,
    isOverdue: status === 'pending' && daysBetween(dueDate, today) > 0,
  };
}

/** Everything due on a given day, whatever its status. */
export function occurrencesOn(data: AppData, date: DateKey, today: DateKey): ChoreOccurrence[] {
  return data.chores
    .filter((chore) => isDueOn(chore, date))
    .map((chore) => buildOccurrence(data, chore.id, date, today))
    .filter((o): o is ChoreOccurrence => Boolean(o))
    .sort(sortOccurrences);
}

/** Missed occurrences from the recent past, oldest first. */
export function overdueOccurrences(data: AppData, today: DateKey): ChoreOccurrence[] {
  const results: ChoreOccurrence[] = [];

  for (let i = OVERDUE_WINDOW_DAYS; i >= 1; i -= 1) {
    const date = addDays(today, -i);
    for (const chore of data.chores) {
      if (!isDueOn(chore, date)) continue;
      const occurrence = buildOccurrence(data, chore.id, date, today);
      if (occurrence?.status === 'pending') results.push(occurrence);
    }
  }

  return results;
}

function sortOccurrences(a: ChoreOccurrence, b: ChoreOccurrence): number {
  // Outstanding work first, then earliest reminder, then highest points.
  const rank = (o: ChoreOccurrence) => (o.status === 'pending' ? 0 : 1);
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  if (a.chore.reminderTime !== b.chore.reminderTime) {
    return a.chore.reminderTime.localeCompare(b.chore.reminderTime);
  }
  if (a.chore.points !== b.chore.points) return b.chore.points - a.chore.points;
  return a.chore.title.localeCompare(b.chore.title);
}

export interface MemberStats {
  member: Member;
  /** Chores completed by this member in the trailing window. */
  completed: number;
  points: number;
  /** Active (non-archived) chores assigned to them. */
  assigned: number;
}

/** Per-member totals over the trailing `windowDays`, highest points first. */
export function memberStats(data: AppData, today: DateKey, windowDays = 30): MemberStats[] {
  const since = addDays(today, -windowDays);

  return data.members
    .map((member) => {
      const completions = data.completions.filter(
        (c) => c.memberId === member.id && daysBetween(since, c.dueDate) >= 0,
      );
      const points = completions.reduce((total, completion) => {
        const chore = data.chores.find((ch) => ch.id === completion.choreId);
        return total + (chore?.points ?? 0);
      }, 0);

      return {
        member,
        completed: completions.length,
        points,
        assigned: data.chores.filter((c) => !c.archived && c.assigneeId === member.id).length,
      };
    })
    .sort((a, b) => b.points - a.points || b.completed - a.completed);
}

/** How far back the history view looks. */
export const HISTORY_WINDOW_DAYS = 90;

export interface DayHistory {
  date: DateKey;
  /** Completed on this day's occurrence. */
  done: ChoreOccurrence[];
  /** Deliberately skipped. */
  skipped: ChoreOccurrence[];
  /** Was due and never settled. Only ever past days. */
  missed: ChoreOccurrence[];
  total: number;
}

/**
 * Day-by-day record of what happened, newest first. Days with nothing due are
 * left out entirely so the list stays readable.
 *
 * Occurrences are resolved against maps keyed on `choreId|dueDate` rather than
 * scanning the completion and skip arrays per day — over a 90 day window that
 * is the difference between a few hundred lookups and tens of thousands.
 */
export function historyByDay(
  data: AppData,
  today: DateKey,
  windowDays = HISTORY_WINDOW_DAYS,
): DayHistory[] {
  const key = (choreId: string, date: DateKey) => `${choreId}|${date}`;

  const completions = new Map(data.completions.map((c) => [key(c.choreId, c.dueDate), c]));
  const skips = new Map(data.skips.map((s) => [key(s.choreId, s.dueDate), s]));
  const members = new Map(data.members.map((m) => [m.id, m]));

  const days: DayHistory[] = [];

  for (let offset = 0; offset < windowDays; offset += 1) {
    const date = addDays(today, -offset);
    const day: DayHistory = { date, done: [], skipped: [], missed: [], total: 0 };

    for (const chore of data.chores) {
      const completion = completions.get(key(chore.id, date));
      const skip = skips.get(key(chore.id, date));

      /*
       * A completion or skip is proof the occurrence happened, so it stays in
       * the history even once the chore is archived — isDueOn reports false
       * for archived chores, which would otherwise erase the record of work
       * that was genuinely done. Only "missed" needs the chore to still be
       * scheduled, since an archived chore should not keep accruing misses.
       */
      const settled = Boolean(completion || skip);
      const scheduled = isDueOn(chore, date);
      if (!settled && !scheduled) continue;

      const status: OccurrenceStatus = completion ? 'done' : skip ? 'skipped' : 'pending';
      const isOverdue = status === 'pending' && daysBetween(date, today) > 0;

      const occurrence: ChoreOccurrence = {
        chore,
        dueDate: date,
        assignee: members.get(chore.assigneeId),
        completion,
        skip,
        status,
        isOverdue,
      };

      if (status === 'done') day.done.push(occurrence);
      else if (status === 'skipped') day.skipped.push(occurrence);
      else if (isOverdue) day.missed.push(occurrence);
      // Still pending and still today: not history yet, so it is left out.
      else continue;

      day.total += 1;
    }

    if (day.total > 0) days.push(day);
  }

  return days;
}

/** Totals across a run of days, for the header summary. */
export function summariseHistory(days: DayHistory[]) {
  return days.reduce(
    (totals, day) => ({
      done: totals.done + day.done.length,
      skipped: totals.skipped + day.skipped.length,
      missed: totals.missed + day.missed.length,
      total: totals.total + day.total,
    }),
    { done: 0, skipped: 0, missed: 0, total: 0 },
  );
}

/** Share of the day's chores that are settled (done or skipped), as 0–1. */
export function completionRate(occurrences: ChoreOccurrence[]): number {
  if (occurrences.length === 0) return 0;
  const settled = occurrences.filter((o) => o.status !== 'pending').length;
  return settled / occurrences.length;
}
