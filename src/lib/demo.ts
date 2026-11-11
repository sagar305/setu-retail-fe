// Demo build (demo.retail-pos.setutechnology.com) only.
//
// VITE_DEMO_MODE=true shows the shared demo login on the sign-in screen, sends
// "Create account" to the real app, and shows when the demo data is next
// wiped. VITE_DEMO_LOGIN is "login|password", inlined into the bundle and
// readable by anyone: it must be the throwaway demo shop's login, nothing else.
import { db } from "../offline/db";
import { clearCache } from "./cache";

export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

/** Where real sign-ups go from the demo. */
export const PRODUCTION_APP_URL = (import.meta.env.VITE_PRODUCTION_APP_URL ?? "https://app.retail-pos.setutechnology.com").replace(/\/$/, "");

export type DemoLogin = { login: string; password: string };

export function parseDemoLogin(raw: string | undefined): DemoLogin | null {
  if (!raw) return null;
  // Split on the first "|" only, so a password containing one survives.
  const at = raw.indexOf("|");
  if (at === -1) return null;
  const login = raw.slice(0, at).trim();
  const password = raw.slice(at + 1).trim();
  return login && password ? { login, password } : null;
}

export const DEMO_LOGIN: DemoLogin | null = DEMO_MODE ? parseDemoLogin(import.meta.env.VITE_DEMO_LOGIN) : null;

/** "1:04:09" past an hour, "4:09" under one. */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(s / 3600);
  const m = Math.floor(s / 60) % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

/**
 * After a reset the cloud no longer has what this device saved or queued, so
 * the demo starts each sign-in from a clean device copy.
 */
export async function clearDemoDevice() {
  await clearCache();
  await Promise.all([db.outbox.clear(), db.customers.clear(), db.money.clear(), db.changes.clear(), db.packs.clear()]).catch(() => {});
}
