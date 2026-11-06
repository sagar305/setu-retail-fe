import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { apiGet } from "../lib/api";
import { navForRole } from "../lib/nav";
import type { Role } from "../lib/roles";
import { Logo } from "./Logo";

type Props = { role: Role; businessName: string; expired?: boolean; onNavigate?: () => void; className?: string };

/** How many changes wait for the owner's pick (Phase 9b). */
function useReviewCount(enabled: boolean): number {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const load = () => void apiGet<{ open: number }>("/conflicts/count").then((r) => setN(r.open), () => {});
    load();
    const id = window.setInterval(load, 5 * 60_000);
    window.addEventListener("setu:review", load);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("setu:review", load);
    };
  }, [enabled]);
  return n;
}

export function Sidebar({ role, businessName, expired, onNavigate, className = "" }: Props) {
  const review = useReviewCount(role === "OWNER" && !expired);
  // When the plan has ended the owner can only reach the plan screen.
  const items = navForRole(role).filter((item) => !expired || item.path === "/settings/plan");
  return (
    <nav
      id="app-sidebar"
      aria-label="Main"
      className={"flex w-[248px] shrink-0 flex-col gap-1 overflow-y-auto bg-indigo px-3.5 py-5 text-white md:w-[232px] " + className}
    >
      <div className="px-2 pb-4">
        <Logo subtitle={businessName} />
      </div>
      {items.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          onClick={onNavigate}
          className={({ isActive }) =>
            "flex h-11 items-center gap-3 rounded-[10px] px-3 text-sm no-underline " +
            (isActive ? "bg-saffron font-semibold text-ink" : "text-white hover:bg-indigo-600")
          }
        >
          <Icon size={18} aria-hidden="true" />
          {label}
          {path === "/review" && review > 0 ? (
            <span className="ml-auto rounded-full bg-saffron px-2 py-0.5 text-xs font-bold text-ink" aria-label={`${review} to review`}>
              {review}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
