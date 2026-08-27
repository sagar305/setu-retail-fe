import AsyncStorage from '@react-native-async-storage/async-storage';
import { createId, isUuid } from '@/lib/id';
import type { Chore, DateKey } from '@/types';
import * as api from './api';

// v2 discards queues written before ids were UUIDs. Those writes could never
// be accepted by the database, and a stuck one blocked everything behind it.
const QUEUE_KEY = 'chorely:pending:v2';

/**
 * A write that has been applied locally but not yet accepted by the server.
 * Every variant is idempotent, so replaying one after an uncertain failure is
 * always safe.
 */
export type PendingOp =
  | { kind: 'upsertChore'; chore: Chore }
  | { kind: 'deleteChore'; choreId: string }
  | { kind: 'complete'; choreId: string; dueDate: DateKey; memberId: string }
  | { kind: 'uncomplete'; choreId: string; dueDate: DateKey }
  | { kind: 'skip'; choreId: string; dueDate: DateKey }
  | { kind: 'unskip'; choreId: string; dueDate: DateKey }
  | { kind: 'snooze'; choreId: string; dueDate: DateKey; remindAt: string; count: number }
  | { kind: 'clearSnooze'; choreId: string; dueDate: DateKey };

export interface QueuedWrite {
  id: string;
  householdId: string;
  userId: string;
  queuedAt: string;
  op: PendingOp;
}

export async function readQueue(): Promise<QueuedWrite[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedWrite[]) : [];
  } catch {
    return [];
  }
}

async function writeQueue(queue: QueuedWrite[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueue(
  op: PendingOp,
  householdId: string,
  userId: string,
): Promise<void> {
  const queue = await readQueue();
  queue.push({
    id: createId(),
    householdId,
    userId,
    queuedAt: new Date().toISOString(),
    op,
  });
  await writeQueue(queue);
}

/**
 * Every id in these writes lands in a `uuid` column. A write carrying anything
 * else can never be accepted, so it is discarded rather than retried forever.
 */
function isSendable(write: QueuedWrite): boolean {
  const { op } = write;
  const choreId = op.kind === 'upsertChore' ? op.chore.id : op.choreId;
  if (!isUuid(choreId)) return false;
  if (op.kind === 'complete' && !isUuid(op.memberId)) return false;
  return true;
}

async function send(write: QueuedWrite): Promise<void> {
  const { op, householdId, userId } = write;

  switch (op.kind) {
    case 'upsertChore':
      return api.upsertChore(op.chore, householdId, userId);
    case 'deleteChore':
      return api.deleteChore(op.choreId);
    case 'complete':
      return api.markComplete(op.choreId, householdId, op.memberId, op.dueDate);
    case 'uncomplete':
      return api.clearComplete(op.choreId, op.dueDate);
    case 'skip':
      return api.markSkipped(op.choreId, householdId, op.dueDate);
    case 'unskip':
      return api.clearSkipped(op.choreId, op.dueDate);
    case 'snooze':
      return api.saveSnooze(op.choreId, householdId, op.dueDate, op.remindAt, op.count);
    case 'clearSnooze':
      return api.clearSnooze(op.choreId, op.dueDate);
    default:
      return undefined;
  }
}

const PERMANENT_FAILURES = new Set(['22P02', '23503', '23514', 'PGRST116']);

export interface FlushResult {
  /** Writes the server accepted. */
  sent: number;
  /** Writes discarded because they could never be accepted. */
  dropped: number;
  remaining: number;
}

/**
 * Drains the queue oldest-first, stopping at the first failure so later writes
 * can never overtake earlier ones. A write whose target row no longer exists
 * is dropped rather than retried forever.
 */
export async function flushQueue(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, dropped: 0, remaining: 0 };

  let settled = 0;
  let sent = 0;
  let dropped = 0;

  for (const write of queue) {
    if (!isSendable(write)) {
      settled += 1;
      dropped += 1;
      continue;
    }

    try {
      await send(write);
      settled += 1;
      sent += 1;
    } catch (error) {
      const code = (error as { code?: string })?.code;

      // These can never succeed however often they are retried, so drop them
      // instead of letting one wedge every write queued behind it:
      //   22P02  malformed uuid
      //   23503  the row it references is gone
      //   23514  fails a check constraint
      if (code && PERMANENT_FAILURES.has(code)) {
        settled += 1;
        dropped += 1;
        continue;
      }

      // Anything else is likely transient (offline, timeout). Stop here so
      // later writes cannot overtake this one.
      break;
    }
  }

  const remaining = queue.slice(settled);
  await writeQueue(remaining);
  return { sent, dropped, remaining: remaining.length };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
