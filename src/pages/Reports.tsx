import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Card, Field, PageHeader, SelectField } from "../components/ui";
import { apiGet, type GstReport, type SalesReport, type StaffReport, type StockLog, type StockReport } from "../lib/api";
import { currentBranch } from "../lib/branch";
import { downloadCsv, toCsv } from "../lib/csv";
import { errorMessage, formatDate } from "../lib/format";
import { stateLabel } from "../lib/gstStates";
import { bpToPercent, formatMoney, formatQty } from "../lib/money";
import { PRESETS, presetDays, toRange, type Preset } from "../lib/ranges";

type Tab = "sales" | "gst" | "stock" | "staff" | "log";
const TABS: { id: Tab; label: string }[] = [
  { id: "sales", label: "Sales" },
  { id: "gst", label: "GST" },
  { id: "stock", label: "Stock & expiry" },
  { id: "staff", label: "Staff & margin" },
  { id: "log", label: "Stock log" },
];

const rupee = (p: number) => (p / 100).toFixed(2);

function Table({ head, rows, empty = "Nothing in this range.", minW = 640 }: { head: ReactNode[]; rows: ReactNode[][]; empty?: string; minW?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full border-collapse text-sm" style={{ minWidth: minW }}>
        <thead>
          <tr className="bg-paper text-left text-xs text-muted">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2.5 font-medium ${i ? "text-right" : ""}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-line">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2.5 ${j ? "text-right" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="m-0 px-4 py-5 text-center text-muted">{empty}</p> : null}
    </div>
  );
}

function Section({ title, onCsv, children }: { title: string; onCsv?: () => void; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
        {onCsv ? (
          <Button variant="ghost" onClick={onCsv}>
            Download CSV
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1 !p-4">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-xl font-bold text-indigo">{value}</span>
    </Card>
  );
}

export function ReportsPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "sales") as Tab;
  const [preset, setPreset] = useState<Preset>("today");
  const init = presetDays("today", new Date(), tz);
  const [custom, setCustom] = useState({ first: init.first, last: init.last });
  const [branchId, setBranchId] = useState(tab === "stock" || tab === "log" ? (currentBranch(me)?.id ?? "") : "");
  // Each result remembers which tab and filters it is for, so switching tabs never renders old data.
  const [result, setResult] = useState<{ key: string; value: unknown } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const needsBranch = tab === "stock" || tab === "log";
  const effectiveBranch = needsBranch ? branchId || currentBranch(me)?.id || "" : branchId;

  const days = preset === "custom" ? custom : presetDays(preset, new Date(), tz);
  const range = useMemo(() => toRange(days.first, days.last, tz), [days.first, days.last, tz]);
  const fileTag = days.first === days.last ? days.first : `${days.first}_to_${days.last}`;

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams();
    if (tab !== "stock") {
      q.set("from", range.from);
      q.set("to", range.to);
    }
    if (effectiveBranch) q.set("branchId", effectiveBranch);
    const path = { sales: "/reports/sales", gst: "/reports/gst", stock: "/reports/stock", staff: "/reports/staff", log: "/reports/stock-log" }[tab];
    const key = `${tab}?${q}`;
    apiGet(`${path}?${q}`).then(
      (r) => {
        if (!alive) return;
        setResult({ key, value: r });
        setError(null);
      },
      (err: unknown) => alive && setError(errorMessage(err)),
    );
    return () => {
      alive = false;
    };
  }, [tab, range, effectiveBranch]);
  const currentKey = (() => {
    const q = new URLSearchParams();
    if (tab !== "stock") {
      q.set("from", range.from);
      q.set("to", range.to);
    }
    if (effectiveBranch) q.set("branchId", effectiveBranch);
    return `${tab}?${q}`;
  })();
  const data = result?.key === currentKey ? result.value : null;

  return (
    <div className="w-full">
      <PageHeader title="Reports" description={me.user.role === "MANAGER" ? "Your branches only" : "All amounts include GST unless marked taxable"} />
      <nav aria-label="Report" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-current={tab === t.id ? "page" : undefined}
            onClick={() => setParams({ tab: t.id })}
            className={`min-h-10 rounded-[10px] px-3.5 text-sm ${tab === t.id ? "bg-indigo font-semibold text-white" : "border border-line bg-white"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <Card className="mb-5 flex flex-wrap items-end gap-3 !p-4">
        {tab !== "stock" ? (
          <>
            <div role="group" aria-label="Date range" className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${preset === p.id ? "bg-indigo-50 font-semibold text-indigo ring-2 ring-indigo" : "border border-line bg-white"}`}>
                  {p.label}
                </button>
              ))}
            </div>
            {preset === "custom" ? (
              <>
                <Field label="From" type="date" value={custom.first} max={custom.last} onChange={(e) => e.target.value && setCustom({ ...custom, first: e.target.value })} />
                <Field label="To" type="date" value={custom.last} min={custom.first} onChange={(e) => e.target.value && setCustom({ ...custom, last: e.target.value })} />
              </>
            ) : null}
          </>
        ) : null}
        {me.branches.length > 1 ? (
          <div className="min-w-[200px]">
            <SelectField label="Branch" value={effectiveBranch} onChange={(e) => setBranchId(e.target.value)}>
              {!needsBranch ? <option value="">All branches</option> : null}
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
      </Card>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {!data && !error ? <p className="text-muted">Loading…</p> : null}
      {data && tab === "sales" ? <Sales r={data as SalesReport} tag={fileTag} branchName={(id) => me.branches.find((b) => b.id === id)?.name ?? id} /> : null}
      {data && tab === "gst" ? <Gst r={data as GstReport} tag={fileTag} tz={tz} /> : null}
      {data && tab === "stock" ? <Stock r={data as StockReport} /> : null}
      {data && tab === "staff" ? <Staff r={data as StaffReport} tag={fileTag} /> : null}
      {data && tab === "log" ? <Log r={data as StockLog} tag={fileTag} tz={tz} /> : null}
    </div>
  );
}

function Sales({ r, tag, branchName }: { r: SalesReport; tag: string; branchName: (id: string) => string }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Stat label="Sales" value={formatMoney(r.sales)} />
        <Stat label="Returns" value={formatMoney(r.returns)} />
        <Stat label="Net sales" value={formatMoney(r.net)} />
        <Stat label="Bills" value={String(r.bills)} />
        <Stat label="Average bill" value={formatMoney(r.averageBill)} />
        <Stat label="Discounts given" value={formatMoney(r.discounts)} />
      </div>
      {r.cancelled.count ? <Alert tone="info">{r.cancelled.count} cancelled bill{r.cancelled.count === 1 ? "" : "s"} ({formatMoney(r.cancelled.total)}) not counted.</Alert> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="By payment method" onCsv={() => downloadCsv(`Sales_by_payment_${tag}.csv`, toCsv(["Method", "Amount"], r.byPayment.map((p) => [p.method, rupee(p.amount)])))}>
          <Table minW={320} head={["Method", "Amount"]} rows={[...r.byPayment.map((p) => [p.method, formatMoney(p.amount)]), ...r.refundsByMethod.map((p) => [`Refunds · ${p.method}`, `−${formatMoney(p.amount)}`])]} />
        </Section>
        <Section title="By day" onCsv={() => downloadCsv(`Sales_by_day_${tag}.csv`, toCsv(["Day", "Bills", "Sales"], r.byDay.map((d) => [d.day, d.bills, rupee(d.sales)])))}>
          <Table minW={320} head={["Day", "Bills", "Sales"]} rows={r.byDay.map((d) => [d.day, d.bills, formatMoney(d.sales)])} />
        </Section>
        <Section title="Top products" onCsv={() => downloadCsv(`Top_products_${tag}.csv`, toCsv(["Product", "Qty", "Unit", "Amount"], r.topProducts.map((p) => [p.name, p.qtyMilli / 1000, p.unit, rupee(p.amount)])))}>
          <Table minW={360} head={["Product", "Qty", "Amount"]} rows={r.topProducts.map((p) => [p.name, `${formatQty(p.qtyMilli)} ${p.unit}`, formatMoney(p.amount)])} />
        </Section>
        {r.byBranch.length > 1 ? (
          <Section title="By branch">
            <Table minW={320} head={["Branch", "Bills", "Sales"]} rows={r.byBranch.map((b) => [branchName(b.branchId), b.bills, formatMoney(b.sales)])} />
          </Section>
        ) : null}
      </div>
    </div>
  );
}

function Gst({ r, tag, tz }: { r: GstReport; tag: string; tz: string }) {
  const sum = (k: string) => r.byRate.reduce((s, x) => s + (x[`net_${k}`] ?? 0), 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Stat label="Net taxable value" value={formatMoney(sum("taxable"))} />
        <Stat label="CGST" value={formatMoney(sum("cgst"))} />
        <Stat label="SGST" value={formatMoney(sum("sgst"))} />
        <Stat label="IGST" value={formatMoney(sum("igst"))} />
      </div>
      <Section
        title="By GST rate (sales − credit notes)"
        onCsv={() =>
          downloadCsv(
            `GST_by_rate_${tag}.csv`,
            toCsv(
              ["Rate %", "Sales taxable", "Sales CGST", "Sales SGST", "Sales IGST", "Returns taxable", "Returns CGST", "Returns SGST", "Returns IGST", "Net taxable", "Net CGST", "Net SGST", "Net IGST"],
              r.byRate.map((x) => [bpToPercent(x.rateBp ?? 0), ...["sales", "returns", "net"].flatMap((p) => ["taxable", "cgst", "sgst", "igst"].map((k) => rupee(x[`${p}_${k}`] ?? 0)))]),
            ),
          )
        }
      >
        <Table
          minW={720}
          head={["Rate", "Taxable", "CGST", "SGST", "IGST", "Returns (taxable)", "Net taxable"]}
          rows={r.byRate.map((x) => [`${bpToPercent(x.rateBp ?? 0)}%`, formatMoney(x.sales_taxable ?? 0), formatMoney(x.net_cgst ?? 0), formatMoney(x.net_sgst ?? 0), formatMoney(x.net_igst ?? 0), formatMoney(x.returns_taxable ?? 0), formatMoney(x.net_taxable ?? 0)])}
        />
      </Section>
      <Section title="HSN summary" onCsv={() => downloadCsv(`GST_HSN_${tag}.csv`, toCsv(["HSN", "Rate %", "UQC", "Qty", "Taxable", "CGST", "SGST", "IGST", "Total"], r.byHsn.map((h) => [h.hsn, bpToPercent(h.rateBp), h.unit, h.qtyMilli / 1000, rupee(h.taxable), rupee(h.cgst), rupee(h.sgst), rupee(h.igst), rupee(h.total)])))}>
        <Table minW={720} head={["HSN", "Rate", "Qty", "Taxable", "CGST", "SGST", "IGST"]} rows={r.byHsn.map((h) => [h.hsn || <span className="text-muted">No HSN</span>, `${bpToPercent(h.rateBp)}%`, `${formatQty(h.qtyMilli)} ${h.unit}`, formatMoney(h.taxable), formatMoney(h.cgst), formatMoney(h.sgst), formatMoney(h.igst)])} />
      </Section>
      <Section title="B2B bills (customers with GSTIN)" onCsv={() => downloadCsv(`GST_B2B_${tag}.csv`, toCsv(["Invoice", "Date", "Customer", "GSTIN", "Place of supply", "Taxable", "CGST", "SGST", "IGST", "Total"], r.b2b.map((b) => [b.invoiceNumber, formatDate(b.date, tz), b.customerName, b.customerGstin, b.placeOfSupply, rupee(b.taxable), rupee(b.cgst), rupee(b.sgst), rupee(b.igst), rupee(b.total)])))}>
        <Table minW={820} head={["Bill", "Customer · GSTIN", "Place of supply", "Taxable", "Tax", "Total"]} rows={r.b2b.map((b) => [b.invoiceNumber, `${b.customerName} · ${b.customerGstin}`, stateLabel(b.placeOfSupply), formatMoney(b.taxable), formatMoney(b.cgst + b.sgst + b.igst), formatMoney(b.total)])} empty="No bills to GST-registered customers." />
      </Section>
      <Section title="B2C (walk-in and customers without GSTIN)" onCsv={() => downloadCsv(`GST_B2C_${tag}.csv`, toCsv(["Type", "Place of supply", "Bills", "Taxable", "CGST", "SGST", "IGST", "Total"], r.b2c.map((b) => [b.interState ? "Inter-state" : "Intra-state", b.placeOfSupply, b.bills, rupee(b.taxable), rupee(b.cgst), rupee(b.sgst), rupee(b.igst), rupee(b.total)])))}>
        <Table minW={640} head={["Type", "Place of supply", "Bills", "Taxable", "Tax"]} rows={r.b2c.map((b) => [b.interState ? "Inter-state" : "Intra-state", stateLabel(b.placeOfSupply), b.bills, formatMoney(b.taxable), formatMoney(b.cgst + b.sgst + b.igst)])} />
      </Section>
      <Section title="Credit notes" onCsv={() => downloadCsv(`GST_credit_notes_${tag}.csv`, toCsv(["Credit note", "Date", "Against bill", "Customer", "GSTIN", "Taxable", "CGST", "SGST", "IGST", "Total"], r.creditNotes.map((c) => [c.number, formatDate(c.date, tz), c.invoiceNumber, c.customerName, c.customerGstin ?? "", rupee(c.taxable), rupee(c.cgst), rupee(c.sgst), rupee(c.igst), rupee(c.total)])))}>
        <Table minW={720} head={["Credit note", "Against bill", "Taxable", "Tax", "Total"]} rows={r.creditNotes.map((c) => [c.number, c.invoiceNumber, formatMoney(c.taxable), formatMoney(c.cgst + c.sgst + c.igst), formatMoney(c.total)])} empty="No credit notes." />
      </Section>
    </div>
  );
}

function Stock({ r }: { r: StockReport }) {
  const [filter, setFilter] = useState<"attention" | "all">("attention");
  const items = r.items.filter((i) => filter === "all" || i.status !== "ok");
  const tone = { ok: "ok", low: "warn", out: "error", negative: "error" } as const;
  const label = { ok: "OK", low: "Low", out: "Out", negative: "Below zero" };
  const buckets = { expired: "Expired", "30": "Within 30 days", "60": "31–60 days", "90": "61–90 days" };
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Stat label="Stock value at cost" value={formatMoney(r.value)} />
        <Stat label="Low" value={String(r.counts.low)} />
        <Stat label="Out of stock" value={String(r.counts.out)} />
        <Stat label="Below zero" value={String(r.counts.negative)} />
      </div>
      {r.missingCost ? <Alert tone="info">{r.missingCost} product{r.missingCost === 1 ? " has" : "s have"} no cost price, so the value is incomplete.</Alert> : null}
      {r.batchTracking ? (
        <Section title="Expiring batches (next 90 days)" onCsv={() => downloadCsv("Expiring_batches.csv", toCsv(["Product", "Batch", "Expiry", "Qty", "Unit", "Value at cost", "When"], r.expiring.map((b) => [b.productName, b.batchNo, b.expiry, b.qtyMilli / 1000, b.unit, b.value === null ? "" : rupee(b.value), buckets[b.bucket]])))}>
          <Table minW={640} head={["Product", "Batch", "Expiry", "Qty", "Value", "When"]} rows={r.expiring.map((b) => [b.productName, b.batchNo || "—", b.expiry, `${formatQty(b.qtyMilli)} ${b.unit}`, b.value === null ? "—" : formatMoney(b.value), <Badge tone={b.bucket === "expired" ? "error" : b.bucket === "30" ? "warn" : "muted"}>{buckets[b.bucket]}</Badge>])} empty="No batches expire in the next 90 days." />
        </Section>
      ) : (
        <Alert tone="info">Turn on batch & expiry tracking in Settings → Billing & receipt to see expiring stock.</Alert>
      )}
      <Section title="Stock" onCsv={() => downloadCsv("Stock.csv", toCsv(["Product", "Stock", "Unit", "Cost price", "Value at cost", "Status"], r.items.map((i) => [i.name, i.stockMilli / 1000, i.unit, i.costPrice === null ? "" : rupee(i.costPrice), rupee(i.value), label[i.status]])))}>
        <div role="group" aria-label="Show" className="flex gap-2">
          {(["attention", "all"] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={`min-h-9 rounded-full px-3 text-[13px] ${filter === f ? "bg-indigo text-white" : "border border-line bg-white"}`}>
              {f === "attention" ? "Needs attention" : "All products"}
            </button>
          ))}
        </div>
        <Table minW={560} head={["Product", "Stock", "Value at cost", "Status"]} rows={items.map((i) => [i.name, `${formatQty(i.stockMilli)} ${i.unit}`, formatMoney(i.value), <Badge tone={tone[i.status]}>{label[i.status]}</Badge>])} empty="Every product has enough stock." />
      </Section>
    </div>
  );
}

function Staff({ r, tag }: { r: StaffReport; tag: string }) {
  const totalRevenue = r.margin.reduce((s, m) => s + m.revenue, 0);
  const known = r.margin.filter((m) => m.margin !== null);
  const totalMargin = known.reduce((s, m) => s + m.margin!, 0);
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="By cashier" onCsv={() => downloadCsv(`Sales_by_cashier_${tag}.csv`, toCsv(["Name", "Role", "Bills", "Sales", "Discounts", "Returned"], r.byCashier.map((c) => [c.name, c.role ?? "", c.bills, rupee(c.sales), rupee(c.discounts), rupee(c.returns)])))}>
          <Table minW={480} head={["Name", "Bills", "Sales", "Discounts", "Returned"]} rows={r.byCashier.map((c) => [c.name, c.bills, formatMoney(c.sales), formatMoney(c.discounts), formatMoney(c.returns)])} />
        </Section>
        <Section title="By counter" onCsv={() => downloadCsv(`Sales_by_counter_${tag}.csv`, toCsv(["Counter", "Name", "Bills", "Sales"], r.byCounter.map((c) => [c.code, c.name, c.bills, rupee(c.sales)])))}>
          <Table minW={360} head={["Counter", "Bills", "Sales"]} rows={r.byCounter.map((c) => [`${c.code} · ${c.name}`, c.bills, formatMoney(c.sales)])} />
        </Section>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
        <Stat label="Sales (taxable, net of returns)" value={formatMoney(totalRevenue)} />
        <Stat label="Gross margin (where cost is known)" value={formatMoney(totalMargin)} />
      </div>
      <Section title="Margin by product" onCsv={() => downloadCsv(`Margin_${tag}.csv`, toCsv(["Product", "Qty", "Unit", "Sales (taxable)", "Cost", "Margin", "Margin %"], r.margin.map((m) => [m.name, m.qtyMilli / 1000, m.unit, rupee(m.revenue), m.cost === null ? "" : rupee(m.cost), m.margin === null ? "" : rupee(m.margin), m.marginBp === null ? "" : bpToPercent(m.marginBp)])))}>
        <p className="m-0 text-xs text-muted">Sales are without GST and net of returns. Products sold without a cost price show "—".</p>
        <Table minW={640} head={["Product", "Qty", "Sales", "Cost", "Margin", "%"]} rows={r.margin.map((m) => [m.name, `${formatQty(m.qtyMilli)} ${m.unit}`, formatMoney(m.revenue), m.cost === null ? "—" : formatMoney(m.cost), m.margin === null ? "—" : formatMoney(m.margin), m.marginBp === null ? "—" : `${bpToPercent(m.marginBp)}%`])} />
      </Section>
    </div>
  );
}

function Log({ r, tag, tz }: { r: StockLog; tag: string; tz: string }) {
  const kinds: Record<string, string> = { OPENING: "Opening", ADD: "Added", REDUCE: "Reduced", SET: "Set (count)", SALE: "Sale", CANCEL: "Bill cancelled", RETURN: "Returned" };
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: tz });
  return (
    <Section title="Stock movements" onCsv={() => downloadCsv(`Stock_log_${tag}.csv`, toCsv(["When", "Product", "Change", "Unit", "Stock after", "Type", "Note", "By"], r.log.map((l) => [when(l.createdAt), l.productName, l.changeMilli / 1000, l.unit, l.stockAfterMilli / 1000, kinds[l.type] ?? l.type, l.note, l.userName])))}>
      <Table minW={760} head={["When", "Product", "Change", "Stock after", "Why", "By"]} rows={r.log.map((l) => [when(l.createdAt), l.productName, <span className={l.changeMilli < 0 ? "text-[#A3361F]" : "text-ok"}>{l.changeMilli > 0 ? "+" : ""}{formatQty(l.changeMilli)}</span>, `${formatQty(l.stockAfterMilli)} ${l.unit}`, `${kinds[l.type] ?? l.type}${l.note ? ` · ${l.note}` : ""}`, l.userName || "—"])} empty="No stock moved in this range." />
    </Section>
  );
}
