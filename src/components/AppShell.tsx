import { Lock, Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { useIsDesktop } from "../hooks/useIsDesktop";
import { useSidebar } from "../hooks/useSidebar";
import { ROLE_LABEL, type Role } from "../lib/roles";
import { Sidebar } from "./Sidebar";
import { SyncStatus } from "./SyncStatus";

export type SessionPreview = { role: Role; name: string; businessName: string; branch: string };

export function AppShell({ session, onRoleChange }: { session: SessionPreview; onRoleChange?: (role: Role) => void }) {
  // Desktop: the sidebar sits beside the page and its open/closed state is
  // remembered. Phone: it is a drawer over the page, closed by default and
  // closed again after picking a screen.
  const isDesktop = useIsDesktop();
  const desktop = useSidebar();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const open = isDesktop ? desktop.open : drawerOpen;
  const toggle = isDesktop ? desktop.toggle : () => setDrawerOpen((was) => !was);
  const closeDrawer = () => setDrawerOpen(false);
  const initials = session.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex min-h-screen">
      {isDesktop && open ? <Sidebar role={session.role} businessName={session.businessName} /> : null}
      {!isDesktop && open ? (
        <div className="fixed inset-0 z-40 flex">
          <Sidebar role={session.role} businessName={session.businessName} onNavigate={closeDrawer} className="h-full shadow-xl" />
          <button type="button" aria-label="Close menu" onClick={closeDrawer} className="flex-1 bg-ink/40" />
        </div>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b border-line bg-white px-4 py-3.5 md:px-6">
          <button
            type="button"
            onClick={toggle}
            aria-label={open ? "Hide menu" : "Show menu"}
            aria-expanded={open}
            aria-controls="app-sidebar"
            className="flex size-11 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <div className="mr-auto flex flex-col">
            <span className="text-sm text-muted">{session.branch}</span>
          </div>
          {onRoleChange ? (
            <label className="flex items-center gap-2 text-[13px] text-muted">
              Preview as
              <select
                value={session.role}
                onChange={(e) => onRoleChange(e.target.value as Role)}
                className="h-10 rounded-[10px] border border-line-strong bg-white px-2 text-sm text-ink"
              >
                {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <SyncStatus />
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-full bg-cream text-sm font-semibold" aria-hidden="true">
              {initials}
            </div>
            <div className="flex flex-col text-[13px] leading-tight">
              <span className="font-semibold">{session.name}</span>
              <span className="text-muted">{ROLE_LABEL[session.role]}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Lock counter"
            className="flex size-11 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
          >
            <Lock size={18} aria-hidden="true" />
          </button>
        </header>
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
