import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/settings/pos", label: "Billing & receipt" },
  { to: "/settings/import", label: "Import & export" },
  { to: "/settings/plan", label: "Plan & key" },
];

export function SettingsTabs() {
  return (
    <nav aria-label="Settings" className="mb-5 flex flex-wrap gap-2">
      {TABS.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `flex min-h-10 items-center rounded-[10px] px-3.5 text-sm no-underline ${isActive ? "bg-indigo font-semibold text-white" : "border border-line bg-white text-ink"}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
