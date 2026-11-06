// Background refresh (Phase 9a): keeps this device's copy of every screen
// fresh while there's internet, so screens open instantly and still work
// offline. Refreshes the main lists for the user's role, plus every screen
// they opened in the last 3 days (exactly as that screen asked for it).
import type { Me } from "./api";
import { fetchAndCache } from "./api";
import { recentPaths } from "./cache";

export const PREFETCH_EVERY_MS = 3 * 60_000;

/** The main lists, as the screens request them. */
export function seedPaths(me: Me): string[] {
  const role = me.user.role;
  const manager = role === "OWNER" || role === "MANAGER";
  const paths = ["/settings", "/payment-methods", "/categories", "/receipt-templates", "/customers?q=&limit=200", "/ledger/customers"];
  for (const b of me.branches) paths.push(`/products?branchId=${b.id}&limit=2000`, `/held-carts?branchId=${b.id}`);
  if (manager) {
    paths.push("/reports/dashboard", "/suppliers", "/suppliers?q=", "/purchases?q=", "/ledger/suppliers", "/expense-categories", "/transfers", "/staff", "/branches", "/reports/aging/customers", "/reports/aging/suppliers");
    if (me.branches.length > 1) for (const b of me.branches) paths.push(`/reports/dashboard?branchId=${b.id}`);
  }
  return paths;
}

let running = false;

/** One pass: refresh everything, two at a time. Errors (a tool switched off, no internet) are skipped. */
export async function prefetchAll(me: Me): Promise<number> {
  if (running || (typeof navigator !== "undefined" && !navigator.onLine)) return 0;
  running = true;
  try {
    const paths = [...new Set([...seedPaths(me), ...(await recentPaths())])].slice(0, 120);
    let done = 0;
    const queue = [...paths];
    const worker = async () => {
      for (let p = queue.shift(); p !== undefined; p = queue.shift()) {
        try {
          await fetchAndCache(p);
          done += 1;
        } catch {
          /* skip: no access, tool off, or the cloud is unreachable */
        }
      }
    };
    await Promise.all([worker(), worker()]);
    return done;
  } finally {
    running = false;
  }
}
