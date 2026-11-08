import { useEffect, useMemo, useState } from "react";
import { useMe } from "../../auth/AuthProvider";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Button, PageHeader } from "../../components/ui";
import { apiGet, type ProfitReport } from "../../lib/api";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage } from "../../lib/format";
import { bpToPercent, formatMoney } from "../../lib/money";
import { shopDay } from "../../lib/ranges";

type Range = "month" | "last" | "quarter" | "year";
const RANGES: { id: Range; label: string }[] = [
  { id: "month", label: "This month" },
  { id: "last", label: "Last month" },
  { id: "quarter", label: "Last 3 months" },
  { id: "year", label: "This year (Apr–Mar)" },
];

function rangeDays(r: Range, today: string): { from: string; to: string } {
  const [y, m] = today.split("-").map(Number) as [number, number];
  const first = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1)).toISOString().slice(0, 10);
  const lastOf = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).toISOString().slice(0, 10);
  if (r === "month") return { from: first(y, m), to: today };
  if (r === "last") return { from: first(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1), to: lastOf(m === 1 ? y - 1 : y, m === 1 ? 12 : m - 1) };
  if (r === "quarter") return { from: first(m <= 2 ? y - 1 : y, ((m + 9) % 12) + 1), to: today };
  // Indian financial year: 1 April to 31 March.
  return { from: `${m >= 4 ? y : y - 1}-04-01`, to: today };
}

const periodLabel = (p: string, monthly: boolean) =>
  new Date(`${monthly ? `${p}-01` : p}T12:00:00Z`).toLocaleDateString("en-IN", monthly ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", timeZone: "UTC" });

/** Profit Dashboard: net sales before tax − cost of goods sold − expenses. */
export function ProfitPage() {
  const me = useMe();
  const today = shopDay(new Date(), me.account.timezone);
  const [range, setRange] = useState<Range>("month");
  const [branchId, setBranchId] = useState("");
  const [r, setR] = useState<ProfitReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { from, to } = useMemo(() => rangeDays(range, today), [range, today]);

  useEffect(() => {
    apiGet<ProfitReport>(`/reports/profit?from=${from}&to=${to}${branchId ? `&branchId=${branchId}` : ""}`).then(setR, (e: unknown) => setError(errorMessage(e)));
  }, [from, to, branchId]);

  const monthly = r?.period === "month";
  const peak = Math.max(1, ...(r?.byPeriod ?? []).map((p) => Math.max(p.revenue, Math.abs(p.netProfit))));
  const branchName = (id: string) => me.branches.find((b) => b.id === id)?.name ?? id;
  return (
    <div className="w-full">
      <PageHeader
        title="Profit Dashboard"
        description="Net sales before tax, after returns, minus what the goods cost and minus expenses."
        actions={
          <Button
            variant="secondary"
            disabled={!r?.byPeriod.length}
            onClick={() => downloadCsv(`Profit_${from}_${to}.csv`, toCsv([monthly ? "Month" : "Day", "Net sales (before tax)", "Cost of goods", "Gross profit", "Expenses", "Net profit"], (r?.byPeriod ?? []).map((p) => [p.period, (p.revenue / 100).toFixed(2), (p.cost / 100).toFixed(2), (p.grossProfit / 100).toFixed(2), (p.expenses / 100).toFixed(2), (p.netProfit / 100).toFixed(2)])))}
          >
            Export CSV
          </Button>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {RANGES.map((x) => (
          <button key={x.id} type="button" aria-pressed={range === x.id} onClick={() => setRange(x.id)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${range === x.id ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}>
            {x.label}
          </button>
        ))}
        {me.branches.length > 1 ? (
          <select aria-label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)} className="ml-auto h-11 rounded-[10px] border border-line-strong bg-white px-2 text-sm">
            <option value="">All branches</option>
            {me.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>
        ) : null}
      </div>
      {r?.uncosted.lines ? (
        <Alert tone="warn">
          {r.uncosted.lines} sold item line{r.uncosted.lines === 1 ? "" : "s"} ({formatMoney(r.uncosted.revenue)} of sales) had no cost price, so their cost counts as zero. Add cost prices in Products or enter supplier bills.
        </Alert>
      ) : null}
      <div className="my-4 flex flex-wrap gap-3">
        <Stat label="Net sales (before tax)" value={formatMoney(r?.revenue ?? 0)} />
        <Stat label="Cost of goods sold" value={formatMoney(r?.cost ?? 0)} />
        <Stat label={`Gross profit${r?.grossMarginBp !== null && r?.grossMarginBp !== undefined ? ` · ${bpToPercent(r.grossMarginBp)}%` : ""}`} value={formatMoney(r?.grossProfit ?? 0)} />
        <Stat label="Expenses" value={formatMoney(r?.expenses ?? 0)} />
        <Stat label="Net profit" value={formatMoney(r?.netProfit ?? 0)} tone={r && r.netProfit < 0 ? "warn" : "ok"} />
      </div>
      <section aria-label={monthly ? "By month" : "By day"} className="mb-5 rounded-2xl border border-line bg-white p-4">
        <h2 className="mt-0 mb-3 text-base font-semibold">{monthly ? "By month" : "By day"}</h2>
        {!r?.byPeriod.length ? <p className="m-0 text-sm text-muted">No sales or expenses in this period.</p> : null}
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {(r?.byPeriod ?? []).map((p) => (
            <li key={p.period} className="grid grid-cols-[72px_1fr_110px] items-center gap-3 text-sm">
              <span className="text-muted">{periodLabel(p.period, monthly)}</span>
              <span className="flex flex-col gap-0.5" aria-hidden="true">
                <span className="h-2.5 rounded-full bg-indigo-50">
                  <span className="block h-2.5 rounded-full bg-indigo" style={{ width: `${(Math.max(0, p.revenue) / peak) * 100}%` }} />
                </span>
                <span className="h-2.5 rounded-full">
                  <span className={`block h-2.5 rounded-full ${p.netProfit < 0 ? "bg-[#A3361F]" : "bg-saffron"}`} style={{ width: `${(Math.abs(p.netProfit) / peak) * 100}%` }} />
                </span>
              </span>
              <span className={`text-right font-semibold ${p.netProfit < 0 ? "text-[#A3361F]" : ""}`}>{formatMoney(p.netProfit)}</span>
            </li>
          ))}
        </ul>
        {r?.byPeriod.length ? (
          <p className="mt-3 mb-0 flex gap-4 text-xs text-muted">
            <span>
              <span className="mr-1 inline-block size-2.5 rounded-full bg-indigo" />
              Net sales
            </span>
            <span>
              <span className="mr-1 inline-block size-2.5 rounded-full bg-saffron" />
              Net profit
            </span>
          </p>
        ) : null}
      </section>
      <div className="flex flex-wrap items-start gap-5">
        <section className="flex min-w-0 flex-[2_1_480px] flex-col gap-2">
          <h2 className="m-0 text-base font-semibold">By branch</h2>
          <DataTable minW={520} head={["Branch", "Net sales", "Cost", "Expenses", "Net profit"]} rows={(r?.byBranch ?? []).map((b) => ({ key: b.branchId, cells: [branchName(b.branchId), formatMoney(b.revenue), formatMoney(b.cost), formatMoney(b.expenses), <strong key="n">{formatMoney(b.netProfit)}</strong>] }))} empty="Nothing in this period." />
        </section>
        <section className="flex min-w-0 flex-[1_1_280px] flex-col gap-2">
          <h2 className="m-0 text-base font-semibold">Expenses by category</h2>
          <DataTable minW={260} head={["Category", "Amount"]} rows={(r?.expensesByCategory ?? []).map((c) => ({ key: c.category, cells: [c.category, formatMoney(c.amount)] }))} empty="No expenses." />
        </section>
      </div>
    </div>
  );
}
