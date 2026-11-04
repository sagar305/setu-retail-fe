// This device's counter in a branch, its device key and its own bill series.
import { apiGet, apiPost, type Counter } from "../lib/api";
import { readPref, writePref } from "../lib/storage";
import { db, kvGet, kvSet } from "./db";

const counterPref = (branchId: string) => `setu-retail:counter:${branchId}`;
const keyFor = (counterId: string) => `deviceKey:${counterId}`;
const seqFor = (counterId: string) => `seq:${counterId}`;

export function savedCounterId(branchId: string): string | null {
  return readPref(counterPref(branchId));
}

export async function deviceKeyFor(counterId: string): Promise<string | undefined> {
  return kvGet<string>(keyFor(counterId));
}

/**
 * Register this device as a counter once per branch (online, signed in) and
 * keep its device key. A counter made before Phase 3 gets a key on first use.
 */
export async function ensureCounter(branchId: string): Promise<Counter> {
  const saved = savedCounterId(branchId);
  if (saved) {
    const { counters } = await apiGet<{ counters: Counter[] }>(`/counters?branchId=${branchId}`);
    const found = counters.find((c) => c.id === saved);
    if (found) {
      if (!(await deviceKeyFor(found.id))) {
        const { deviceKey } = await apiPost<{ deviceKey: string }>(`/counters/${found.id}/device-key`);
        await kvSet(keyFor(found.id), deviceKey);
      }
      return found;
    }
  }
  const { counter, deviceKey } = await apiPost<{ counter: Counter; deviceKey: string }>("/counters", { branchId, name: guessDeviceName() });
  writePref(counterPref(branchId), counter.id);
  await kvSet(keyFor(counter.id), deviceKey);
  return counter;
}

/** The next bill number on this counter, without using it up. */
export async function peekSeq(counterId: string, serverNext: number): Promise<number> {
  return Math.max((await kvGet<number>(seqFor(counterId))) ?? 1, serverNext);
}

/** Mark bill number `n` as used. Numbers only ever move forward. */
export async function takeSeq(counterId: string, n: number) {
  await db.transaction("rw", db.kv, async () => {
    const cur = (await kvGet<number>(seqFor(counterId))) ?? 1;
    await kvSet(seqFor(counterId), Math.max(cur, n + 1));
  });
}

export const invoiceNumber = (branchCode: string, counterCode: string, n: number) => `${branchCode}-${counterCode}-${String(n).padStart(5, "0")}`;

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android phone";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  return "Counter";
}
