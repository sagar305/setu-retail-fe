// Device cache for GET answers (Phase 9a: local-first reads).
//
// - A screen's data comes from this device first, so it opens instantly; the
//   cloud copy is fetched in the background and saved for next time.
// - Offline, every screen shows the last copy this device saw.
// - Any change saved through the API marks everything stale, so the next read
//   goes to the cloud first (a screen that just saved sees its own change).
// - Each user's copy is separate: when a different person signs in on this
//   device, the previous person's copy is wiped.
// Access tokens are never stored here (or anywhere on disk).
import { db, type CachedResponse, type Effect } from "../offline/db";
import { applyEffects } from "./effects";

/** Answers younger than this are shown without waiting for the cloud. */
const INSTANT_MS = 10 * 60_000;
/** Answers younger than this aren't refetched in the background either. */
const FRESH_MS = 15_000;
/** Paths not opened for this long stop being prefetched, and are deleted. */
export const KEEP_MS = 3 * 24 * 3600_000;

let owner: string | null = null;
/** Tests turn instant answers off so each mocked request is really made. */
let instant = true;
let lastSuccess = 0;
const listeners = new Set<(path: string) => void>();

export const cacheOwner = () => owner;
export function setInstantCache(on: boolean) {
  instant = on;
}
export function resetCacheState() {
  owner = null;
  instant = true;
  lastSuccess = 0;
  listeners.clear();
}

/**
 * Who this device's copy belongs to. A different user than before wipes the
 * old copy (decision v1.9: a device keeps only what its user may see).
 */
export async function setCacheOwner(userId: string | null) {
  if (userId && owner !== userId) {
    await db.responses.where("owner").notEqual(userId).delete().catch(() => {});
  }
  owner = userId;
}

const keyOf = (path: string) => `${owner}|${path}`;

export async function readCache<T>(path: string): Promise<{ data: T; fetchedAt: number } | null> {
  if (!owner) return null;
  const row = await db.responses.get(keyOf(path)).catch(() => undefined);
  if (!row) return null;
  void db.responses.update(row.key, { usedAt: Date.now() }).catch(() => {});
  return { data: row.data as T, fetchedAt: row.fetchedAt };
}

/** Effects of this user's changes still waiting to reach the cloud, oldest first. */
async function pendingEffects(): Promise<Effect[]> {
  if (!owner) return [];
  const rows = await db.changes.where("userId").equals(owner).toArray().catch(() => []);
  return rows.filter((c) => c.status === "pending").sort((a, b) => a.createdAt.localeCompare(b.createdAt)).flatMap((c) => c.effects);
}

/** Save a fresh cloud answer; returns it as screens should see it (with this device's pending changes on top). */
export async function writeCache<T>(path: string, fresh: T): Promise<T> {
  if (!owner) return fresh;
  const now = Date.now();
  lastSuccess = now;
  // The cloud doesn't have this device's pending changes yet: keep showing them.
  const effects = await pendingEffects();
  const data = effects.length ? applyEffects(path, fresh, effects) : fresh;
  const row: CachedResponse = { key: keyOf(path), owner, path, data, fetchedAt: now, usedAt: now };
  await db.responses.put(row).catch(() => {});
  for (const l of listeners) l(path);
  return data as T;
}

const effectListeners = new Set<(effects: readonly Effect[]) => void>();
/** Called with the effects of every change saved on this device (lists held in memory apply them too). */
export function onLocalEffects(fn: (effects: readonly Effect[]) => void) {
  effectListeners.add(fn);
  return () => effectListeners.delete(fn);
}

/** A change was just saved on this device: show it on every cached screen at once. */
export async function applyToCache(effects: readonly Effect[]) {
  if (!effects.length) return;
  for (const l of effectListeners) l(effects);
  if (!owner) return;
  const rows = await db.responses.where("owner").equals(owner).toArray().catch(() => [] as CachedResponse[]);
  for (const r of rows) {
    const data = applyEffects(r.path, r.data, effects);
    if (data !== r.data) await db.responses.update(r.key, { data }).catch(() => {});
  }
  for (const r of rows) for (const l of listeners) l(r.path);
}

/** After a change: everything is stale, so the next read asks the cloud first. */
export async function invalidateCache() {
  if (!owner) return;
  await db.responses.where("owner").equals(owner).modify({ fetchedAt: 0 }).catch(() => {});
}

/** How a cached answer should be used now. */
export function cachePolicy(fetchedAt: number, now = Date.now()): "use" | "use-and-refresh" | "network-first" {
  if (!instant) return "network-first";
  const age = now - fetchedAt;
  if (age < FRESH_MS) return "use";
  if (age < INSTANT_MS) return "use-and-refresh";
  return "network-first";
}

/** Paths this user opened recently: the prefetcher keeps them fresh. */
export async function recentPaths(): Promise<string[]> {
  if (!owner) return [];
  const since = Date.now() - KEEP_MS;
  const rows = await db.responses.where("owner").equals(owner).toArray().catch(() => [] as CachedResponse[]);
  const old = rows.filter((r) => r.usedAt < since).map((r) => r.key);
  if (old.length) void db.responses.bulkDelete(old).catch(() => {});
  return rows.filter((r) => r.usedAt >= since).sort((a, b) => b.usedAt - a.usedAt).map((r) => r.path);
}

/** When this device last heard from the cloud (0 = not this session). */
export const lastCloudContact = () => lastSuccess;
export function noteCloudContact() {
  lastSuccess = Date.now();
}

/** Called with a path whenever a fresh copy of it is saved. */
export function onCacheUpdate(fn: (path: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Wipe everything (sign-out by a different user, or tests). */
export async function clearCache() {
  await db.responses.clear().catch(() => {});
}
