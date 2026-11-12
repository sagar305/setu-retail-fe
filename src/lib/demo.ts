// Demo build (demo.retail-pos.setutechnology.com) only.
//
// VITE_DEMO_MODE=true shows the shared demo logins on the sign-in screen, sends
// "Create account" to the real app, and shows when the demo data is next
// wiped. VITE_DEMO_LOGIN (see parseDemoLogins) is inlined into the bundle and
// readable by anyone: only the throwaway demo shop's logins, nothing else.
import { db } from "../offline/db";
import { clearCache } from "./cache";

/** An env value without surrounding spaces or quotes (pasted as "true" in a dashboard). */
export const unquote = (v: string | undefined) => (v ?? "").trim().replace(/^(["'])(.*)\1$/, "$2").trim();
/** true / 1 / yes / on, in any case. */
export const isOn = (v: string | undefined) => /^(true|1|yes|on)$/i.test(unquote(v));

export const DEMO_MODE = isOn(import.meta.env.VITE_DEMO_MODE);

/** Where real sign-ups go from the demo. */
export const PRODUCTION_APP_URL = (unquote(import.meta.env.VITE_PRODUCTION_APP_URL) || "https://app.retail-pos.setutechnology.com").replace(/\/$/, "");

export type DemoLogin = { label: string; login: string; password: string };

/**
 * VITE_DEMO_LOGIN lists the demo logins, separated by ";", each as
 * "Label=login|password" (e.g. "Owner=owner|pw;Cashier=cashier|pw"). A bare
 * "login|password" is one login labelled "Demo".
 */
export function parseDemoLogins(raw: string | undefined): DemoLogin[] {
  if (!raw) return [];
  return unquote(raw).split(";").flatMap((entry) => {
    const bar = entry.indexOf("|");
    if (bar === -1) return [];
    const head = entry.slice(0, bar);
    const eq = head.indexOf("=");
    const label = eq === -1 ? "Demo" : head.slice(0, eq).trim();
    const login = (eq === -1 ? head : head.slice(eq + 1)).trim();
    const password = entry.slice(bar + 1).trim();
    return label && login && password ? [{ label, login, password }] : [];
  });
}

export const DEMO_LOGINS: DemoLogin[] = DEMO_MODE ? parseDemoLogins(import.meta.env.VITE_DEMO_LOGIN) : [];

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
