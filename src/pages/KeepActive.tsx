import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { Alert, Button, Card } from "../components/ui";
import { apiGet, apiPost, type Branch, type Role } from "../lib/api";
import { errorMessage, formatDate } from "../lib/format";
import { homePathFor } from "../lib/nav";
import { ROLE_LABEL } from "../lib/roles";

type Person = { id: string; name: string; role: Role; withinPlan: boolean; createdAt: string };
type Data = { limits: { maxBranches: number | null; maxStaff: number | null }; branches: Branch[]; staff: Person[] };

const oldest = <T extends { createdAt: string }>(rows: T[], max: number | null) =>
  new Set([...rows].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).slice(0, max ?? rows.length).map((r) => (r as unknown as { id: string }).id));

/** After a smaller plan starts: the owner picks what stays active; the oldest are picked already. */
export function KeepActivePage() {
  const { reloadMe, state } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<Data | null>(null);
  const [branchIds, setBranchIds] = useState<Set<string>>(new Set());
  const [staffIds, setStaffIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const tz = state.status === "signedIn" ? state.me.account.timezone : undefined;

  useEffect(() => {
    apiGet<Data>("/account/keep-active").then(
      (d) => {
        setData(d);
        setBranchIds(new Set(d.branches.filter((b) => b.withinPlan).map((b) => b.id)));
        setStaffIds(new Set(d.staff.filter((s) => s.withinPlan).map((s) => s.id)));
      },
      (err: unknown) => setError(errorMessage(err)),
    );
  }, []);

  if (!data) return <div className="mx-auto max-w-3xl">{error ? <Alert tone="error">{error}</Alert> : <p className="text-muted">Loading…</p>}</div>;

  const { maxBranches, maxStaff } = data.limits;
  const singleBranch = maxBranches === 1;
  const autoOldest = () => {
    setBranchIds(oldest(data.branches, maxBranches));
    setStaffIds(oldest(data.staff, maxStaff));
  };
  const toggle = (set: Set<string>, id: string, max: number | null, update: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else if (max === null || next.size < max) next.add(id);
    update(next);
  };

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await apiPost("/account/keep-active", { branchIds: [...branchIds], staffIds: [...staffIds] });
      await reloadMe();
      navigate(homePathFor("OWNER"), { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[28px] font-semibold">Choose what stays active</h1>
        <p className="m-0 leading-relaxed text-muted">
          Your plan allows {maxBranches ?? "unlimited"} branch{maxBranches === 1 ? "" : "es"} and {maxStaff ?? "unlimited"} staff. Nothing is deleted: what you don't pick becomes read-only until you upgrade. The oldest are picked for you.
        </p>
      </div>
      <Button variant="secondary" onClick={autoOldest} className="self-start">
        Auto-select oldest
      </Button>
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-[17px] font-semibold">{singleBranch ? "Branch to keep working with" : "Branches that stay active"}</h2>
          <span className="text-[13px] text-muted">
            {branchIds.size} of {maxBranches ?? data.branches.length} picked
          </span>
        </div>
        {data.branches.map((b) => {
          const on = branchIds.has(b.id);
          return (
            <label key={b.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 ${on ? "border-2 border-indigo" : "border border-line"}`}>
              <input
                type={singleBranch ? "radio" : "checkbox"}
                name="branch"
                checked={on}
                disabled={!on && !singleBranch && maxBranches !== null && branchIds.size >= maxBranches}
                onChange={() => (singleBranch ? setBranchIds(new Set([b.id])) : toggle(branchIds, b.id, maxBranches, setBranchIds))}
                className="size-[18px] accent-indigo"
              />
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">
                  {b.name} ({b.code})
                </span>
                <span className="text-xs text-muted">Added {formatDate(b.createdAt, tz)}</span>
              </span>
              <span className={`text-xs font-semibold ${on ? "text-ok" : "text-muted"}`}>{on ? "Stays active" : "Read-only"}</span>
            </label>
          );
        })}
      </Card>

      {data.staff.length ? (
        <Card className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="m-0 text-[17px] font-semibold">Staff who can still sign in</h2>
            <span className="text-[13px] text-muted">
              {staffIds.size} of {maxStaff ?? data.staff.length} picked
            </span>
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {data.staff.map((s) => {
              const on = staffIds.has(s.id);
              return (
                <label key={s.id} className={`flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-3 ${on ? "border-2 border-indigo" : "border border-line"}`}>
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={!on && maxStaff !== null && staffIds.size >= maxStaff}
                    onChange={() => toggle(staffIds, s.id, maxStaff, setStaffIds)}
                    className="size-[18px] accent-indigo"
                  />
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">{s.name}</span>
                    <span className="text-xs text-muted">
                      {ROLE_LABEL[s.role]} · since {formatDate(s.createdAt, tz)}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => navigate("/settings/plan")}>
          Upgrade instead
        </Button>
        <Button onClick={confirm} busy={busy} disabled={branchIds.size === 0}>
          Confirm and continue
        </Button>
      </div>
    </div>
  );
}
