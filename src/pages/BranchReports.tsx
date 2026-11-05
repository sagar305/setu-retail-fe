import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { DataTable, Stat } from "../components/DataTable";
import { Alert, Badge, Button, PageHeader } from "../components/ui";
import { apiGet, type BranchComparison, type StockAcross, type TransferReport } from "../lib/api";
import { downloadCsv, toCsv } from "../lib/csv";
import { errorMessage, formatDate } from "../lib/format";
import { formatMoney, formatQty } from "../lib/money";
import { PRESETS, presetDays, type Preset } from "../lib/ranges";

type Tab = "compare" | "stock" | "transfers";
const TABS: { id: Tab; label: string }[] = [
  { id: "compare", label: "Branches side by side" },
  { id: "stock", label: "Stock across branches" },
  { id: "transfers", label: "Transfers" },
];
const rupee = (p: number) => (p / 100).toFixed(2);

/** Branch reports: compare branches, see stock everywhere, and what moved between them. */
export function BranchReportsPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "compare";
  const [preset, setPreset] = useState<Exclude<Preset, "custom">>("month");
  const [q, setQ] = useState("");
  const [onlySuggestions, setOnlySuggestions] = useState(false);
  const [data, setData] = useState<{ tab: Tab; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => presetDays(preset, new Date(), tz), [preset, tz]);

  useEffect(() => {
    const path = tab === "compare" ? `/reports/branches?from=${days.first}&to=${days.last}` : tab === "transfers" ? `/reports/transfers?from=${days.first}&to=${days.last}` : `/reports/stock-across?q=${encodeURIComponent(q)}${onlySuggestions ? "&only=suggestions" : ""}`;
    const t = window.setTimeout(() => {
      apiGet<unknown>(path).then((value) => setData({ tab, value }), (e: unknown) => setError(errorMessage(e)));
    }, tab === "stock" ? 200 : 0);
    return () => window.clearTimeout(t);
  }, [tab, days, q, onlySuggestions]);
  const shown = data?.tab === tab ? data.value : null;
  const code = (id: string) => me.branches.find((b) => b.id === id)?.code ?? "—";

  return (
    <div className="w-full">
      <PageHeader title="Branch reports" description={me.user.role === "MANAGER" ? "Your branches" : "All branches"} actions={<Link to="/stock-transfers" className="text-sm font-semibold text-indigo">Stock transfers</Link>} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <nav aria-label="Branch reports" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" aria-pressed={tab === t.id} onClick={() => setParams({ tab: t.id })} className={`min-h-10 rounded-[10px] px-3.5 text-sm ${tab === t.id ? "bg-indigo font-semibold text-white" : "border border-line bg-white text-ink"}`}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab !== "stock" ? (
        <div role="group" aria-label="Period" className="mb-4 flex flex-wrap gap-2">
          {PRESETS.filter((p) => p.id !== "custom").map((p) => (
            <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id as typeof preset)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${preset === p.id ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}>
              {p.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <label htmlFor="sa-q" className="sr-only">
            Search products
          </label>
          <input id="sa-q" type="search" placeholder="Search product, SKU or barcode" value={q} onChange={(e) => setQ(e.target.value)} className="h-11 w-full max-w-md rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={onlySuggestions} onChange={(e) => setOnlySuggestions(e.target.checked)} className="size-5 accent-indigo" /> Only where a transfer would help
          </label>
        </div>
      )}

      {tab === "compare" && shown ? <Compare r={shown as BranchComparison} /> : null}
      {tab === "stock" && shown ? <Across r={shown as StockAcross} /> : null}
      {tab === "transfers" && shown ? (
        <Transfers r={shown as TransferReport} code={code} when={(iso) => formatDate(iso, tz)} />
      ) : null}
    </div>
  );
}

function Compare({ r }: { r: BranchComparison }) {
  const best = [...r.branches].sort((a, b) => b.netProfit - a.netProfit)[0];
  const rows: [string, (b: BranchComparison["branches"][number]) => number, boolean?][] = [
    ["Bills", (b) => b.bills, true],
    ["Sales (incl. GST)", (b) => b.sales],
    ["Returns", (b) => b.returns],
    ["Average bill", (b) => b.averageBill],
    ["Net sales before GST", (b) => b.revenue],
    ["Cost of goods", (b) => b.cost],
    ["Gross profit", (b) => b.grossProfit],
    ["Expenses", (b) => b.expenses],
    ["Net profit", (b) => b.netProfit],
    ["Stock value at cost", (b) => b.stockValue],
    ["Udhaar outstanding", (b) => b.udhaar],
    ["Coming in (in transit)", (b) => b.inTransitIn],
  ];
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="Sales, all branches" value={formatMoney(r.branches.reduce((s, b) => s + b.sales, 0))} />
        <Stat label="Net profit, all branches" value={formatMoney(r.branches.reduce((s, b) => s + b.netProfit, 0))} />
        {best && best.bills ? <Stat label="Most profitable" value={`${best.name} (${best.code})`} tone="ok" /> : null}
      </div>
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => downloadCsv(`Branches_${r.from}_${r.to}.csv`, toCsv(["", ...r.branches.map((b) => `${b.name} (${b.code})`)], rows.map(([label, f, count]) => [label, ...r.branches.map((b) => (count ? String(f(b)) : rupee(f(b))))])))}>
          Export CSV
        </Button>
      </div>
      <DataTable
        minW={Math.max(480, 180 + r.branches.length * 140)}
        head={["", ...r.branches.map((b) => `${b.name} (${b.code})`)]}
        rows={rows.map(([label, f, count]) => ({ key: label, cells: [<span key="l" className={label === "Net profit" ? "font-semibold" : ""}>{label}</span>, ...r.branches.map((b) => (count ? f(b) : <span key={b.branchId} className={label === "Net profit" ? `font-bold ${f(b) < 0 ? "text-[#A3361F]" : ""}` : ""}>{formatMoney(f(b))}</span>))] }))}
      />
      {r.udhaarUnassigned ? <p className="m-0 text-sm text-muted">Plus {formatMoney(r.udhaarUnassigned)} of udhaar from opening balances and imported history, not tied to a branch.</p> : null}
    </div>
  );
}

function Across({ r }: { r: StockAcross }) {
  const code = (id: string) => r.branches.find((b) => b.id === id)?.code ?? "";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button variant="ghost" onClick={() => downloadCsv("Stock_across_branches.csv", toCsv(["Product", "SKU", "Unit", ...r.branches.map((b) => b.code), "Total"], r.products.map((p) => [p.name, p.sku, p.unit, ...p.stock.map((s) => formatQty(s.stockMilli)), formatQty(p.total)])))}>
          Export CSV
        </Button>
      </div>
      <DataTable
        minW={Math.max(560, 260 + r.branches.length * 110)}
        head={["Product", ...r.branches.map((b) => b.code), "Total", "Suggestion"]}
        empty="No stocked products match."
        rows={r.products.map((p) => ({
          key: p.productId,
          cells: [
            <span key="n" className="flex flex-col">
              <strong>{p.name}</strong>
              <span className="text-xs text-muted">{[p.sku, p.unit].filter(Boolean).join(" · ")}</span>
            </span>,
            ...p.stock.map((s) => (
              <span key={s.branchId} className={s.status === "out" ? "font-semibold text-[#A3361F]" : s.status === "low" ? "font-semibold text-warn" : ""}>
                {formatQty(s.stockMilli)}
                {s.status !== "ok" ? <span className="block text-[11px] font-normal">{s.status === "out" ? "out" : `low (≤ ${formatQty(s.lowMilli)})`}</span> : null}
              </span>
            )),
            formatQty(p.total),
            p.suggestion ? (
              <Link key="s" to="/stock-transfers" className="text-sm font-semibold">
                Move {formatQty(p.suggestion.qtyMilli)} {code(p.suggestion.fromBranchId)} → {code(p.suggestion.toBranchId)}
              </Link>
            ) : (
              "—"
            ),
          ],
        }))}
      />
    </div>
  );
}

function Transfers({ r, code, when }: { r: TransferReport; code: (id: string) => string; when: (iso: string) => string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3">
        <Stat label="Transfers sent" value={r.totals.sent} />
        <Stat label="Value sent (at cost)" value={formatMoney(r.totals.sentValue)} />
        <Stat label="In transit now" value={`${r.totals.inTransit} · ${formatMoney(r.totals.inTransitValue)}`} tone={r.totals.inTransit ? "warn" : undefined} />
        <Stat label="Short: back to sender" value={formatMoney(r.totals.returnedValue)} />
        <Stat label="Short: written off" value={formatMoney(r.totals.writtenOffValue)} tone={r.totals.writtenOffValue ? "warn" : undefined} />
      </div>
      <DataTable
        minW={680}
        left={3}
        head={["Transfer", "Sent", "From → To", "Products", "Value", "Short", "Status"]}
        empty="No transfers in this period."
        rows={r.rows.map((t) => ({
          key: t.id,
          muted: t.status === "CANCELLED",
          cells: [
            t.number,
            when(t.sentAt),
            `${code(t.fromBranchId)} → ${code(t.toBranchId)}`,
            t.lines,
            formatMoney(t.value),
            t.returnedValue + t.writtenOffValue ? formatMoney(t.returnedValue + t.writtenOffValue) : "—",
            <Badge key="s" tone={t.status === "SENT" ? "warn" : t.status === "RECEIVED" ? "ok" : "muted"}>
              {t.status === "SENT" ? "In transit" : t.status === "RECEIVED" ? "Received" : "Cancelled"}
            </Badge>,
          ],
        }))}
      />
    </div>
  );
}
