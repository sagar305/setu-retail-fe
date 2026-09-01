import type {
  Chore,
  Completion,
  Member,
  Recurrence,
  Skip,
  Snooze,
  SnoozeSetting,
} from '@/types';
import type {
  ChoreCompletionRow,
  ChoreRow,
  ChoreSkipRow,
  ChoreSnoozeRow,
  ProfileRow,
} from '@/supabase/types';

/**
 * Postgres returns `time` as HH:MM:SS; the app works in HH:MM throughout.
 */
function toTimeKey(value: string): string {
  return value.slice(0, 5);
}

export function memberFromProfile(row: ProfileRow): Member {
  return {
    id: row.id,
    // Fall back to the local part of the email if they never set a name.
    name: row.full_name?.trim() || row.email.split('@')[0],
    color: row.color,
    createdAt: row.created_at,
  };
}

export function choreFromRow(row: ChoreRow): Chore {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes ?? undefined,
    room: row.room ?? undefined,
    assigneeId: row.assignee_id,
    recurrence: row.recurrence as unknown as Recurrence,
    startDate: row.start_date,
    scheduleMode: row.schedule_mode ?? 'fixed',
    nextDueDate: row.next_due_date ?? undefined,
    reminderTime: toTimeKey(row.reminder_time),
    defaultSnooze: row.default_snooze as unknown as SnoozeSetting,
    points: row.points,
    archived: row.archived,
    createdAt: row.created_at,
  };
}

/** The column subset a client is allowed to write. */
export function choreToRow(chore: Chore, householdId: string, createdBy: string) {
  return {
    id: chore.id,
    household_id: householdId,
    title: chore.title,
    notes: chore.notes ?? null,
    room: chore.room ?? null,
    assignee_id: chore.assigneeId,
    recurrence: chore.recurrence as unknown as Record<string, unknown>,
    start_date: chore.startDate,
    schedule_mode: chore.scheduleMode,
    next_due_date: chore.nextDueDate ?? null,
    reminder_time: chore.reminderTime,
    default_snooze: chore.defaultSnooze as unknown as Record<string, unknown>,
    points: chore.points,
    archived: chore.archived,
    created_by: createdBy,
  };
}

export function completionFromRow(row: ChoreCompletionRow): Completion {
  return {
    id: row.id,
    choreId: row.chore_id,
    memberId: row.member_id ?? '',
    dueDate: row.due_date,
    completedAt: row.completed_at,
  };
}

export function skipFromRow(row: ChoreSkipRow): Skip {
  return {
    id: row.id,
    choreId: row.chore_id,
    dueDate: row.due_date,
    skippedAt: row.skipped_at,
  };
}

export function snoozeFromRow(row: ChoreSnoozeRow): Snooze {
  return {
    id: row.id,
    choreId: row.chore_id,
    dueDate: row.due_date,
    remindAt: row.remind_at,
    count: row.count,
  };
}
