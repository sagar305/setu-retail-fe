import { LogOut } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useAdmin, useAdminAuth } from "./AdminAuth";

const NAV = [
  { to: "/super-admin", label: "Dashboard", end: true },
  { to: "/super-admin/accounts", label: "Accounts" },
  { to: "/super-admin/keys", label: "Keys" },
  { to: "/super-admin/activity", label: "Activity" },
  { to: "/super-admin/team", label: "Team" },
];

/** The Setu team's area: dark header so it never looks like a shop's screens. */
export function AdminShell() {
  const admin = useAdmin();
  const { logout } = useAdminAuth();
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-saffron font-bold text-ink" aria-hidden="true">
            S
          </div>
          <span className="font-semibold">
            Setu Retail <span className="text-saffron">Admin</span>
          </span>
          <span className="ml-auto hidden truncate text-sm text-[#D9DCEE] sm:inline">{admin.name}</span>
          <button type="button" onClick={() => void logout()} className="flex min-h-11 items-center gap-2 rounded-[10px] px-3 text-sm font-semibold text-white hover:bg-white/10 max-sm:ml-auto">
            <LogOut size={16} aria-hidden="true" /> Sign out
          </button>
        </div>
        <nav aria-label="Admin" className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `flex min-h-11 shrink-0 items-center border-b-[3px] px-3 text-sm font-semibold ${isActive ? "border-saffron text-white" : "border-transparent text-[#B9BDD6] hover:text-white"}`}
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
