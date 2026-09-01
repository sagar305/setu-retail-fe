export type MemberId = string;
export type ChoreId = string;
/** A calendar day as YYYY-MM-DD. */
export type DateKey = string;
/** A time of day as HH:MM in 24-hour form. */
export type TimeKey = string;

export interface Member {
  id: MemberId;
  name: string;
  /** Hex colour used for the member's avatar chip. */
  color: string;
  createdAt: string;
}

/**
 * The frequency presets offered when adding a chore.
 * `monthly` and `twiceMonthly` are week-based (every 4 / every 2 weeks on a
 * chosen weekday), so they never hit the "31st of February" problem.
 */
export type FrequencyPreset =
  | 'once'
  | 'daily'
  | 'alternate'
  | 'weekday'
  | 'sunday'
  | 'monthly'
  | 'twiceMonthly'
  | 'alternateSunday'
  | 'custom';

export type CustomUnit = 'day' | 'week' | 'month';

export interface CustomRecurrence {
  unit: CustomUnit;
  /** Repeat every N days / weeks / months. */
  interval: number;
  /** 0 = Sunday … 6 = Saturday. Used when unit is `week`. */
  daysOfWeek?: number[];
  /** Dates within the month, e.g. [5, 20]. Used when unit is `month`. */
  datesOfMonth?: number[];
}

export interface Recurrence {
  preset: FrequencyPreset;
  /** Chosen weekday for `monthly` and `twiceMonthly`. 0 = Sunday. */
  weekday?: number;
  /** Only present when preset is `custom`. */
  custom?: CustomRecurrence;
}

export type SnoozePresetId = '6h' | '12h' | '1d' | '1w' | 'custom';
export type SnoozeUnit = 'hour' | 'day';

export interface SnoozeSetting {
  preset: SnoozePresetId;
  /** Only used when preset is `custom`. */
  customAmount?: number;
  customUnit?: SnoozeUnit;
}

/**
 * How the next occurrence is worked out.
 *
 * `fixed`   — the calendar decides. Bins go out every Tuesday whether or not
 *             you did them early last week.
 * `rolling` — the gap since it was last done decides. Clean the fridge four
 *             weeks early and the next one is four weeks from that day.
 */
export type ScheduleMode = 'fixed' | 'rolling';

export interface Chore {
  id: ChoreId;
  title: string;
  notes?: string;
  room?: string;
  /** Every chore must belong to exactly one member. */
  assigneeId: MemberId;
  recurrence: Recurrence;
  /** First day the chore is due. */
  startDate: DateKey;
  scheduleMode: ScheduleMode;
  /**
   * Rolling chores only: the single day this chore is next due. Recomputed
   * from the actual completion date every time it is done, so it walks forward
   * rather than being derived from `startDate`.
   */
  nextDueDate?: DateKey;
  /** When the reminder fires on a due day. */
  reminderTime: TimeKey;
  /** Offered first when a reminder is snoozed; overridable at that moment. */
  defaultSnooze: SnoozeSetting;
  points: number;
  archived: boolean;
  createdAt: string;
}

export interface Completion {
  id: string;
  choreId: ChoreId;
  memberId: MemberId;
  /**
   * The day the work is recorded against. For a fixed chore this is the
   * scheduled occurrence. For a rolling chore it is the day it was actually
   * done, which may be earlier or later than the day it was due.
   */
  dueDate: DateKey;
  completedAt: string;
}

/** An occurrence the assignee chose not to do. Distinct from simply overdue. */
export interface Skip {
  id: string;
  choreId: ChoreId;
  dueDate: DateKey;
  skippedAt: string;
}

/**
 * A deferred reminder for one occurrence. Snoozing moves only the reminder —
 * the chore stays due, and later occurrences are unaffected.
 */
export interface Snooze {
  id: string;
  choreId: ChoreId;
  dueDate: DateKey;
  /** ISO timestamp for when the reminder should fire next. */
  remindAt: string;
  /** How many times this occurrence has been snoozed. Unlimited by design. */
  count: number;
}

export interface AppData {
  members: Member[];
  chores: Chore[];
  completions: Completion[];
  skips: Skip[];
  snoozes: Snooze[];
}

export type OccurrenceStatus = 'pending' | 'done' | 'skipped';

/** A chore resolved against a specific day. */
export interface ChoreOccurrence {
  chore: Chore;
  dueDate: DateKey;
  assignee?: Member;
  completion?: Completion;
  skip?: Skip;
  snooze?: Snooze;
  status: OccurrenceStatus;
  isOverdue: boolean;
}
