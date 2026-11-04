import { useLocation } from "react-router-dom";
import { NAV_ITEMS } from "../lib/nav";

/** Placeholder for screens built in later phases (docs/PLAN.md §10). */
export function ComingSoon() {
  const { pathname } = useLocation();
  const item = NAV_ITEMS.find((n) => n.path === pathname);
  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-line bg-white p-8">
      <h1 className="m-0 text-2xl font-semibold">{item?.label ?? "Page"}</h1>
      <p className="m-0 text-muted">
        This screen arrives in Phase {item?.phase ?? "—"}. Its layout follows the approved UI prototype.
      </p>
    </section>
  );
}
