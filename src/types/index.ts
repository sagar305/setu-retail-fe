export type MemberId = string;
export type ChoreId = string;

export interface Member {
  id: MemberId;
  name: string;
  /** Hex colour used for the member's avatar chip. */
  color: string;
  createdAt: string;
}

export type RecurrenceType = 'once' | 'daily' | 'weekly' | 'monthly';

export interface Recurrence {
  type: RecurrenceType;
  /** Repeat every N days / weeks / months. Ignored for `once`. */
  interval: number;
  /** 0 = Sunday ... 6 = Saturday. Only used by `weekly`. */
  daysOfWeek?: number[];
}

export interface Chore {
  id: ChoreId;
  title: string;
  notes?: string;
  room?: string;
  assigneeId?: MemberId | null;
  recurrence: Recurrence;
  /** First day the chore is due, as YYYY-MM-DD. */
  startDate: string;
  points: number;
  archived: boolean;
  createdAt: string;
}

export interface Completion {
  id: string;
  choreId: ChoreId;
  memberId?: MemberId | null;
  /** The occurrence this completion satisfies, as YYYY-MM-DD. */
  dueDate: string;
  completedAt: string;
}

export interface AppData {
  members: Member[];
  chores: Chore[];
  completions: Completion[];
}

/** A chore resolved against a specific day. */
export interface ChoreOccurrence {
  chore: Chore;
  dueDate: string;
  assignee?: Member;
  completion?: Completion;
  isOverdue: boolean;
}
