import AsyncStorage from '@react-native-async-storage/async-storage';
import { createId } from '@/lib/id';
import type { Chore, DateKey } from '@/types';
import * as api from './api';

const QUEUE_KEY = 'chorely:pending:v1';

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
    id: createId('op_'),
    householdId,
    userId,
    queuedAt: new Date().toISOString(),
    op,
  });
  await writeQueue(queue);
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

export interface FlushResult {
  sent: number;
  remaining: number;
}

/**
 * Drains the queue oldest-first, stopping at the first failure so later writes
 * can never overtake earlier ones. A write whose target row no longer exists
 * is dropped rather than retried forever.
 */
export async function flushQueue(): Promise<FlushResult> {
  const queue = await readQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  let sent = 0;

  for (const write of queue) {
    try {
      await send(write);
      sent += 1;
    } catch (error) {
      const code = (error as { code?: string })?.code;
      // 23503 = foreign key violation: the chore was deleted elsewhere, so
      // this write can never succeed. Drop it and carry on.
      if (code === '23503' || code === 'PGRST116') {
        sent += 1;
        continue;
      }
      break;
    }
  }

  const remaining = queue.slice(sent);
  await writeQueue(remaining);
  return { sent, remaining: remaining.length };
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}
