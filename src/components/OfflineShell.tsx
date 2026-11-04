import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { ROLE_LABEL } from "../lib/roles";
import { Logo } from "./Logo";
import { SyncStatus } from "./SyncStatus";

/** Signed in with a counter PIN and no internet: billing only. */
export function OfflineShell() {
  const { state, logout, leaveOffline } = useAuth();
  const online = useOnlineStatus();
  if (state.status !== "offline") return null;
  const s = state.session;
  const tab = ({ isActive }: { isActive: boolean }) => `flex min-h-10 items-center rounded-[10px] px-3.5 text-sm no-underline ${isActive ? "bg-saffron font-semibold text-ink" : "text-white"}`;
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center gap-3 bg-indigo px-4 py-3 text-white md:px-6">
        <Logo subtitle={`${s.branch.name} (${s.branch.code})`} />
        <nav aria-label="Main" className="flex gap-1">
          <NavLink to="/billing" className={tab}>
            Billing
          </NavLink>
          <NavLink to="/counter-bills" className={tab}>
            Bills on this counter
          </NavLink>
        </nav>
        <span className="ml-auto flex flex-col text-right text-[13px] leading-tight">
          <span className="font-semibold">{s.name}</span>
          <span className="text-[#C9CDE6]">{ROLE_LABEL[s.role]} · signed in offline</span>
        </span>
        <div className="rounded-full bg-white">
          <SyncStatus />
        </div>
        <button type="button" aria-label="Sign out" onClick={() => void logout()} className="flex size-11 items-center justify-center rounded-[10px] border border-[#5B649C] text-white">
          <LogOut size={18} aria-hidden="true" />
        </button>
      </header>
      {online ? (
        <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[#A9D5C2] bg-ok-50 px-4 py-2.5 text-sm text-ok md:px-6">
          The internet is back. Bills are syncing. Sign in with your password to use everything else.
          <button type="button" onClick={() => void leaveOffline()} className="ml-auto font-semibold underline">
            Sign in
          </button>
        </div>
      ) : null}
      <main className="flex-1 p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
