import type { Branch, Role } from "../lib/api";
import { useAuth } from "./AuthProvider";

export type BranchLite = Pick<Branch, "id" | "code" | "name" | "stateCode" | "withinPlan">;
export type SessionInfo = {
  mode: "online" | "offline";
  user: { id: string; name: string; role: Role };
  account: { name: string; timezone: string };
  branches: BranchLite[];
};

/** Who is billing, whether signed in online or with a counter PIN offline. */
export function useSessionInfo(): SessionInfo {
  const { state } = useAuth();
  if (state.status === "signedIn") {
    const me = state.me;
    return { mode: "online", user: { id: me.user.id, name: me.user.name, role: me.user.role }, account: { name: me.account.name, timezone: me.account.timezone }, branches: me.branches.filter((b) => b.withinPlan) };
  }
  if (state.status === "offline") {
    const s = state.session;
    return { mode: "offline", user: { id: s.userId, name: s.name, role: s.role }, account: { name: s.accountName, timezone: s.timezone }, branches: [s.branch] };
  }
  throw new Error("useSessionInfo outside a session");
}
