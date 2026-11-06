// Changes saved on this device first (Phase 9b, decision v1.9).
//
// A screen calls saveChange(): the change is stored here, shown on every
// cached screen at once, and sent to the cloud in the background (now if
// online, later if not) with its id as the Idempotency-Key, so sending it
// twice is harmless. Edits carry `_base` (the values the device saw), so the
// cloud can merge per field and send real clashes to the owner's review list.
//
// Only the person who made a change sends it: on a shared device, another
// person's changes wait until they sign in again.
import { db, type Effect, type PendingChange } from "../offline/db";
import { ApiError, isUnreachable, sendChange } from "./api";
import { applyToCache, cacheOwner, invalidateCache } from "./cache";

/** A new record's id, chosen on the device so it can be used before the cloud has it. */
export const newUuid = (): string =>
  globalThis.crypto?.randomUUID?.() ??
  "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
const newId = () => newUuid().replace(/-/g, "");

type Listener = () => void;
const listeners = new Set<Listener>();
/** Called when changes are added, sent or rejected (the sync chip recounts). */
export function onChangesUpdate(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notify = () => {
  for (const l of listeners) l();
};

export type SaveChange = {
  method: PendingChange["method"];
  path: string;
  body?: Record<string, unknown>;
  label: string;
  /** For edits: the values this device saw for the fields being changed. */
  base?: Record<string, unknown>;
  effects?: Effect[];
};

/** Save a change on this device; it reaches the cloud in the background. Never waits for the network. */
export async function saveChange(c: SaveChange): Promise<PendingChange> {
  const userId = cacheOwner();
  if (!userId) throw new Error("Sign in to save changes.");
  const now = new Date().toISOString();
  const body = c.base ? { ...c.body, _base: c.base, _changedAt: now } : c.method === "DELETE" ? undefined : (c.body ?? {});
  const row: PendingChange = { id: newId(), userId, method: c.method, path: c.path, body, label: c.label, effects: c.effects ?? [], createdAt: now, status: "pending" };
  await db.changes.add(row);
  await applyToCache(row.effects);
  notify();
  window.dispatchEvent(new Event("setu:changes"));
  return row;
}

export type ChangesFlush = { sent: number; rejected: number; conflicts: number; state: "done" | "offline" | "error" };

let flushing: Promise<ChangesFlush> | null = null;

/** Send this user's waiting changes, oldest first. Stops at the first network problem. */
export function flushChanges(): Promise<ChangesFlush> {
  flushing ??= (async (): Promise<ChangesFlush> => {
    const userId = cacheOwner();
    const out: ChangesFlush = { sent: 0, rejected: 0, conflicts: 0, state: "done" };
    if (!userId) return out;
    const rows = (await db.changes.where("userId").equals(userId).toArray()).filter((c) => c.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const c of rows) {
      try {
        const res = await sendChange<{ conflicts?: number } | undefined>(c.method, c.path, c.body, c.id);
        await db.changes.delete(c.id);
        out.sent += 1;
        out.conflicts += res?.conflicts ?? 0;
      } catch (err) {
        if (isUnreachable(err) || (err instanceof ApiError && (err.status === 401 || err.status === 409 || err.status >= 500))) {
          out.state = isUnreachable(err) ? "offline" : "error";
          break;
        }
        // The cloud said no (a rule, a limit, removed meanwhile…): keep it to show, stop showing its effect.
        await db.changes.update(c.id, { status: "rejected", message: err instanceof ApiError ? err.message : "Couldn't save this change." });
        out.rejected += 1;
      }
    }
    if (out.sent || out.rejected) {
      // Screens refetch from the cloud, which now has these changes (or shows what was refused).
      await invalidateCache();
      notify();
    }
    if (out.conflicts) window.dispatchEvent(new Event("setu:review"));
    return out;
  })().finally(() => {
    flushing = null;
  });
  return flushing;
}

export async function dismissChange(id: string) {
  await db.changes.delete(id);
  notify();
}

/** Every change waiting on this device (all users), for counts and the sync panel. */
export async function allChanges(): Promise<PendingChange[]> {
  return db.changes.orderBy("createdAt").toArray();
}
