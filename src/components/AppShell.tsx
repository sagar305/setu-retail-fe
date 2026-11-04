import { KeyRound, LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { useAuth, useMe } from "../auth/AuthProvider";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useSidebar } from "../hooks/useSidebar";
import { formatDate } from "../lib/format";
import { ROLE_LABEL } from "../lib/roles";
import { Sidebar } from "./Sidebar";
import { SyncStatus } from "./SyncStatus";

function PlanBanner() {
  const me = useMe();
  if (me.user.role !== "OWNER") return null;
  const { plan, account } = me;
  if (plan.expired) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[#E8B676] bg-saffron-50 px-4 py-2.5 text-sm md:px-6">
        <strong>Your plan has ended.</strong> Staff can't sign in until you renew.
        <Link to="/settings/plan" className="ml-auto font-semibold text-indigo">
          Redeem a key
        </Link>
      </div>
    );
  }
  if (account.keepActiveReviewPending) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 border-b border-[#E8B676] bg-saffron-50 px-4 py-2.5 text-sm md:px-6">
        Your plan changed. We kept the oldest branches and staff active.
        <Link to="/keep-active" className="ml-auto font-semibold text-indigo">
          Review
        </Link>
      </div>
    );
  }
  if (plan.current?.source === "TRIAL" && plan.daysLeft <= 14) {
    return (
      <div role="status" className="flex flex-wrap items-center gap-3 border-b border-line bg-indigo-50 px-4 py-2.5 text-sm text-indigo md:px-6">
        Your free trial ends on {formatDate(plan.current.endsAt, account.timezone)} ({plan.daysLeft} days).
        <Link to="/settings/plan" className="ml-auto font-semibold">
          Choose a plan
        </Link>
      </div>
    );
  }
  return null;
}

export function AppShell() {
  const me = useMe();
  const { logout } = useAuth();
  // Desktop: the sidebar sits beside the page and its open/closed state is
  // remembered. Phone: it is a drawer over the page, closed by default and
  // closed again after picking a screen.
  const isDesktop = useIsDesktop();
  const desktop = useSidebar();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = isDesktop ? desktop.open : drawerOpen;
  const toggle = isDesktop ? desktop.toggle : () => setDrawerOpen((was) => !was);
  const closeDrawer = () => setDrawerOpen(false);

  const initials = me.user.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const where =
    me.user.role === "OWNER"
      ? `${me.account.name} · ${me.branches.length} branch${me.branches.length === 1 ? "" : "es"}`
      : me.branches.map((b) => `${b.name} (${b.code})`).join(", ");
  const sidebar = { role: me.user.role, businessName: me.account.name, expired: me.plan.expired };

  return (
    <div className="flex min-h-screen">
      {isDesktop && open ? <Sidebar {...sidebar} /> : null}
      {!isDesktop && open ? (
        <div className="fixed inset-0 z-40 flex">
          <Sidebar {...sidebar} onNavigate={closeDrawer} className="h-full shadow-xl" />
          <button type="button" aria-label="Close menu" onClick={closeDrawer} className="flex-1 bg-ink/40" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-line bg-white px-3 py-3 sm:gap-3 md:px-6">
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Hide menu" : "Show menu"}
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <span className="min-w-0 flex-1 truncate text-sm text-muted" title={where}>{where}</span>
          <SyncStatus />
          <div className="flex items-center gap-2.5">
            <div className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-cream text-sm font-semibold sm:flex" aria-hidden="true">
              {initials}
            </div>
            <div className="hidden flex-col text-[13px] leading-tight sm:flex">
              <span className="font-semibold">{me.user.name}</span>
              <span className="text-muted">{ROLE_LABEL[me.user.role]}</span>
            </div>
          </div>
          <Link
            to="/pin"
            aria-label="Counter PIN"
            title="Counter PIN for signing in offline"
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
          >
            <KeyRound size={18} aria-hidden="true" />
          </Link>
          <button
            type="button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void logout()}
            className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
          >
            <LogOut size={18} aria-hidden="true" />
          </button>
        </header>
        <PlanBanner />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
