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
import { db, type CachedResponse } from "../offline/db";

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

export async function writeCache(path: string, data: unknown) {
  if (!owner) return;
  const now = Date.now();
  lastSuccess = now;
  const row: CachedResponse = { key: keyOf(path), owner, path, data, fetchedAt: now, usedAt: now };
  await db.responses.put(row).catch(() => {});
  for (const l of listeners) l(path);
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
