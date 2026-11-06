import { useCallback, useEffect, useState } from "react";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { Link } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { Alert, Card, PageHeader, SelectField } from "../components/ui";
import { apiGet, type Dashboard } from "../lib/api";
import { errorMessage } from "../lib/format";
import { formatMoney, formatQty } from "../lib/money";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1.5">
      <span className="text-[13px] text-muted">{label}</span>
      <span className="text-[28px] leading-tight font-bold text-indigo">{value}</span>
      {sub ? <span className="text-xs text-muted">{sub}</span> : null}
    </Card>
  );
}

export function DashboardPage() {
  const me = useMe();
  const [branchId, setBranchId] = useState("");
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const branchName = new Map(me.branches.map((b) => [b.id, `${b.name} (${b.code})`]));

  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    let alive = true;
    apiGet<Dashboard>(`/reports/dashboard${branchId ? `?branchId=${branchId}` : ""}`).then(
      (r) => alive && setD(r),
      (err: unknown) => alive && setError(errorMessage(err)),
    );
    return () => {
      alive = false;
    };
  }, [branchId, fresh]);
  const bump = useCallback(() => setFresh((n) => n + 1), []);
  useCacheRefresh(["/reports/dashboard"], bump);

  const max = Math.max(1, ...(d?.week ?? []).map((w) => w.sales));
  const vsYesterday = d && d.yesterday.sales > 0 ? Math.round(((d.today.sales - d.yesterday.sales) / d.yesterday.sales) * 100) : null;
  const negatives = (d?.lowStock ?? []).filter((l) => l.status === "negative");
  const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short" });

  return (
    <div className="w-full">
      <PageHeader
        title="Dashboard"
        description={`Today · ${new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: me.account.timezone })}`}
        actions={
          me.branches.length > 1 ? (
            <div className="min-w-[220px]">
              <SelectField label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">All branches ({me.branches.length})</option>
                {me.branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {d ? (
        <div className="flex flex-col gap-5">
          {negatives.length ? (
            <Alert tone="warn">
              {negatives.length} product{negatives.length === 1 ? " is" : "s are"} below zero stock ({negatives.map((n) => n.name).join(", ")}). <Link to="/products" className="font-semibold underline">Review stock</Link>
            </Alert>
          ) : null}
          {d.expiringSoon > 0 ? (
            <Alert tone="warn">
              {d.expiringSoon} batch{d.expiringSoon === 1 ? " expires" : "es expire"} within 30 days. <Link to="/reports?tab=stock" className="font-semibold underline">See expiring stock</Link>
            </Alert>
          ) : null}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
            <Kpi label="Sales today" value={formatMoney(d.today.sales)} sub={vsYesterday === null ? `Yesterday ${formatMoney(d.yesterday.sales)}` : `${vsYesterday >= 0 ? "+" : ""}${vsYesterday}% vs yesterday`} />
            <Kpi label="Bills" value={String(d.today.bills)} sub={`Average bill ${formatMoney(d.today.averageBill)}`} />
            <Kpi label="Net after returns" value={formatMoney(d.today.net)} sub={d.today.returns ? `${formatMoney(d.today.returns)} returned` : "No returns today"} />
            <Kpi label="Udhaar given today" value={formatMoney(d.today.creditGiven)} sub="Sold on credit" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[2fr_1fr]">
            <Card className="flex flex-col gap-3">
              <h2 className="m-0 text-base font-semibold">Sales, last 7 days</h2>
              <div role="img" aria-label={`Daily sales for the last 7 days. ${d.week.map((w) => `${dayLabel(w.day)} ${formatMoney(w.sales)}`).join(", ")}`} className="flex h-48 items-end gap-2.5">
                {d.week.map((w, i) => (
                  <div key={w.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                    <span className="text-[11px] text-muted">{w.sales ? formatMoney(w.sales).replace(/\.\d+$/, "") : ""}</span>
                    <div className={`w-full rounded-t-md ${i === d.week.length - 1 ? "bg-saffron" : "bg-indigo"}`} style={{ height: `${Math.max(2, (w.sales / max) * 100)}%` }} />
                    <span className="text-xs text-muted">{dayLabel(w.day)}</span>
                  </div>
                ))}
              </div>
            </Card>
            <Card className="flex flex-col gap-2">
              <h2 className="m-0 text-base font-semibold">Payments today</h2>
              {d.today.byPayment.length === 0 ? <p className="m-0 text-sm text-muted">No sales yet today.</p> : null}
              {d.today.byPayment.map((p) => (
                <div key={p.method} className="flex justify-between border-t border-cream py-2 text-sm">
                  <span>{p.method}</span>
                  <span className="font-semibold">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            {me.branches.length > 1 && !branchId ? (
              <Card className="flex flex-col gap-2">
                <h2 className="m-0 text-base font-semibold">Branches today</h2>
                {me.branches.map((b) => {
                  const r = d.today.byBranch.find((x) => x.branchId === b.id);
                  return (
                    <div key={b.id} className="flex justify-between border-t border-cream py-2 text-sm">
                      <span>
                        {b.name} <span className="text-muted">({b.code})</span>
                      </span>
                      <span>
                        <strong>{formatMoney(r?.sales ?? 0)}</strong> <span className="text-muted">· {r?.bills ?? 0} bills</span>
                      </span>
                    </div>
                  );
                })}
              </Card>
            ) : null}
            <Card className="flex flex-col gap-2">
              <h2 className="m-0 text-base font-semibold">Top products today</h2>
              {d.today.topProducts.length === 0 ? <p className="m-0 text-sm text-muted">Nothing sold yet.</p> : null}
              {d.today.topProducts.map((t) => (
                <div key={`${t.productId}-${t.name}`} className="flex justify-between border-t border-cream py-2 text-sm">
                  <span>
                    {t.name} <span className="text-muted">× {formatQty(t.qtyMilli)}</span>
                  </span>
                  <span className="font-semibold">{formatMoney(t.amount)}</span>
                </div>
              ))}
            </Card>
            <Card className="flex flex-col gap-2">
              <h2 className="m-0 text-base font-semibold">Low stock</h2>
              {d.lowStock.length === 0 ? <p className="m-0 text-sm text-muted">Nothing is running low.</p> : null}
              {d.lowStock.slice(0, 8).map((l) => (
                <div key={`${l.productId}-${l.branchId}`} className="flex justify-between gap-3 border-t border-cream py-2 text-sm">
                  <span className="min-w-0 truncate">{l.name}</span>
                  {me.branches.length > 1 ? <span className="text-muted">{branchName.get(l.branchId)}</span> : null}
                  <span className={`shrink-0 font-semibold ${l.status === "low" ? "text-warn" : "text-[#A3361F]"}`}>
                    {formatQty(l.stockMilli)} {l.unit}
                  </span>
                </div>
              ))}
            </Card>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/billing" className="flex min-h-11 items-center rounded-[10px] bg-indigo px-4 text-sm font-semibold text-white no-underline">
              New bill
            </Link>
            <Link to="/reports" className="flex min-h-11 items-center rounded-[10px] border border-indigo px-4 text-sm font-semibold text-indigo no-underline">
              Reports
            </Link>
          </div>
        </div>
      ) : !error ? (
        <p className="text-muted">Loading…</p>
      ) : null}
    </div>
  );
}
