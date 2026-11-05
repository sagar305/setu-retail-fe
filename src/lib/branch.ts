import type { Branch, Me } from "./api";
import { readPref, writePref } from "./storage";

const KEY = "setu-retail:branch";

/** The branch this device works in: remembered per device, else the first usable one. */
export function currentBranch(me: Me): Branch | null {
  const usable = me.branches.filter((b) => b.withinPlan);
  const saved = readPref(KEY);
  return usable.find((b) => b.id === saved) ?? usable[0] ?? null;
}

export function rememberBranch(id: string) {
  writePref(KEY, id);
}
