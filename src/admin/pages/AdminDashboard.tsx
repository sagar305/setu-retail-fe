import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card, Field, PageHeader } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { adminApi, type AdminDashboard } from "../api";

function Stat({ label, value, to }: { label: string; value: number; to?: string }) {
  const body = (
    <>
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-2xl font-semibold">{value.toLocaleString("en-IN")}</span>
    </>
  );
  return to ? (
    <Link to={to} className="flex min-h-11 flex-col gap-1 rounded-2xl border border-line bg-white p-4 text-ink no-underline hover:border-indigo">
      {body}
    </Link>
  ) : (
    <div className="flex flex-col gap-1 rounded-2xl border border-line bg-white p-4">{body}</div>
  );
}

export function AdminDashboardPage() {
  const [d, setD] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState("14");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    adminApi.dashboard().then(setD, (e: unknown) => setError(errorMessage(e)));
  }, []);

  async function remindAll() {
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 60) return setError("Choose 1 to 60 days.");
    if (!window.confirm(`Email every owner whose plan ends within ${n} days? Anyone reminded in the last 24 hours is skipped.`)) return;
    setBusy(true);
    setError(null);
    try {
      const r = await adminApi.remindAll(n);
      setDone(`${r.sent} reminder${r.sent === 1 ? "" : "s"} sent${r.skipped ? `, ${r.skipped} skipped` : ""}.`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Dashboard" description="All Setu Retail accounts. Times are India time." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {d ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Accounts" value={d.accounts} to="/super-admin/accounts" />
            <Stat label="On free trial" value={d.trial} to="/super-admin/accounts?status=trial" />
            <Stat label="Paying" value={d.paidByPlan.reduce((s, p) => s + p.accounts, 0)} to="/super-admin/accounts?status=paid" />
            <Stat label="Ending in 14 days" value={d.expiringIn14Days} to="/super-admin/accounts?expiring=14" />
            <Stat label="Plan ended" value={d.expired} to="/super-admin/accounts?status=expired" />
            <Stat label="Email not verified" value={d.unverified} to="/super-admin/accounts?status=unverified" />
            <Stat label="Locked" value={d.locked} to="/super-admin/accounts?status=locked" />
            <Stat label="Sign-ups this month" value={d.signupsThisMonth} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h2 className="m-0 mb-3 text-lg font-semibold">Paying, by plan</h2>
              {d.paidByPlan.length ? (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {d.paidByPlan.map((p) => (
                    <li key={p.code} className="flex justify-between border-b border-line pb-2 last:border-0">
                      <span>{p.name}</span>
                      <strong>{p.accounts.toLocaleString("en-IN")}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="m-0 text-sm text-muted">No paying accounts yet.</p>
              )}
              {d.granted ? <p className="m-0 mt-3 text-sm text-muted">{d.granted} more on free days from Setu.</p> : null}
            </Card>
            <Card>
              <h2 className="m-0 mb-1 text-lg font-semibold">Plan reminders</h2>
              <p className="m-0 mb-3 text-sm text-muted">Owners are emailed automatically at 14, 7 and 1 days before their plan ends. {d.remindersLast7Days} sent in the last 7 days.</p>
              {done ? <Alert tone="ok">{done}</Alert> : null}
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <Field label="Ending within (days)" type="number" min={1} max={60} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className="w-40" />
                <Button variant="secondary" busy={busy} onClick={() => void remindAll()}>
                  Remind them now
                </Button>
              </div>
            </Card>
          </div>
        </>
      ) : !error ? (
        <p className="text-muted">Loading…</p>
      ) : null}
    </div>
  );
}
