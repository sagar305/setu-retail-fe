import { apiGet, apiPost, type Counter } from "./api";
import { readPref, writePref } from "./storage";

const key = (branchId: string) => `setu-retail:counter:${branchId}`;

/**
 * This device's counter in a branch. Registered once and remembered, so each
 * device keeps its own bill series (B1-C2-…).
 */
export async function ensureCounter(branchId: string): Promise<Counter> {
  const saved = readPref(key(branchId));
  if (saved) {
    const { counters } = await apiGet<{ counters: Counter[] }>(`/counters?branchId=${branchId}`);
    const found = counters.find((c) => c.id === saved);
    if (found) return found;
  }
  const { counter } = await apiPost<{ counter: Counter }>("/counters", { branchId, name: guessDeviceName() });
  writePref(key(branchId), counter.id);
  return counter;
}

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android phone";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Mac/i.test(ua)) return "Mac";
  return "Counter";
}
