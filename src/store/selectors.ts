import { DateKey, addDays, daysBetween } from '@/lib/dates';
import { isDueOn } from '@/lib/schedule';
import type { AppData, ChoreOccurrence, Member } from '@/types';

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

  const completion = data.completions.find(
    (c) => c.choreId === choreId && c.dueDate === dueDate,
  );

  return {
    chore,
    dueDate,
    assignee: findMember(data, chore.assigneeId),
    completion,
    isOverdue: !completion && daysBetween(dueDate, today) > 0,
  };
}

/** Everything due on a given day, completed or not. */
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
      if (occurrence && !occurrence.completion) results.push(occurrence);
    }
  }

  return results;
}

function sortOccurrences(a: ChoreOccurrence, b: ChoreOccurrence): number {
  // Outstanding work first, then highest points, then alphabetical.
  const done = Number(Boolean(a.completion)) - Number(Boolean(b.completion));
  if (done !== 0) return done;
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

/** Share of today's chores that are done, as 0–1. */
export function completionRate(occurrences: ChoreOccurrence[]): number {
  if (occurrences.length === 0) return 0;
  const done = occurrences.filter((o) => o.completion).length;
  return done / occurrences.length;
}
