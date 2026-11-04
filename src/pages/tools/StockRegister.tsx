import { useEffect, useMemo, useState } from "react";
import { useMe } from "../../auth/AuthProvider";
import { BranchSelect } from "../../components/BranchSelect";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Button, Modal, PageHeader } from "../../components/ui";
import { useBranchChoice } from "../../hooks/useBranchChoice";
import { apiGet, type StockLog, type StockRegister } from "../../lib/api";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage, formatDate } from "../../lib/format";
import { formatMoney, formatQty } from "../../lib/money";
import { PRESETS, presetDays, toRange, type Preset } from "../../lib/ranges";

const TYPE: Record<string, string> = { OPENING: "Opening", ADD: "Added", REDUCE: "Reduced", SET: "Counted", SALE: "Sale", CANCEL: "Bill cancelled", RETURN: "Customer return", PURCHASE: "Supplier bill", PURCHASE_RETURN: "Returned to supplier", REPLACEMENT: "Replacement in", PURCHASE_CANCEL: "Supplier bill cancelled" };
const q = (milli: number) => (milli ? `${milli > 0 ? "+" : "−"}${formatQty(Math.abs(milli))}` : "—");

/** Stock Register: opening, in, out and closing per product in a branch. */
export function StockRegisterPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const [branch, setBranch] = useBranchChoice();
  const [preset, setPreset] = useState<Exclude<Preset, "custom">>("month");
  const [data, setData] = useState<StockRegister | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ id: string; name: string } | null>(null);
  const [log, setLog] = useState<StockLog["log"] | null>(null);
  const days = useMemo(() => presetDays(preset, new Date(), tz), [preset, tz]);

  useEffect(() => {
    if (!branch) return;
    apiGet<StockRegister>(`/reports/stock-register?branchId=${branch.id}&from=${days.first}&to=${days.last}`).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [branch, days]);
  useEffect(() => {
    if (!detail || !branch) return;
    const r = toRange(days.first, days.last, tz);
    apiGet<StockLog>(`/reports/stock-log?branchId=${branch.id}&productId=${detail.id}&from=${r.from}&to=${r.to}`).then((x) => setLog(x.log), (e: unknown) => setError(errorMessage(e)));
  }, [detail, branch, days, tz]);

  const items = (data?.items ?? []).filter((i) => !search.trim() || i.name.toLowerCase().includes(search.trim().toLowerCase()) || i.sku.toLowerCase() === search.trim().toLowerCase());
  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  return (
    <div className="w-full">
      <PageHeader
        title="Stock Register"
        description={`${branch.name} (${branch.code}). Every movement: supplier bills, sales, returns and counts.`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <BranchSelect value={branch.id} onChange={setBranch} />
            <Button variant="secondary" disabled={!items.length} onClick={() => downloadCsv(`Stock_Register_${branch.code}_${days.first}_${days.last}.csv`, toCsv(["Product", "SKU", "Unit", "Opening", "Purchases", "Sales", "Customer returns", "Returned to supplier", "Adjustments", "Closing", "Value"], items.map((i) => [i.name, i.sku, i.unit, formatQty(i.opening), formatQty(i.purchases), formatQty(-i.sales), formatQty(i.returns), formatQty(-i.supplierReturns), formatQty(i.adjustments), formatQty(i.closing), i.value === null ? "" : (i.value / 100).toFixed(2)])))}>
              Export CSV
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div role="group" aria-label="Period" className="mb-4 flex flex-wrap gap-2">
        {PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id as typeof preset)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${preset === p.id ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="Stock value at cost (closing)" value={formatMoney(data?.value ?? 0)} />
        <Stat label="Products with movements" value={data?.items.length ?? 0} />
        {data?.missingCost ? <Stat label="In stock without a cost price" value={data.missingCost} tone="warn" /> : null}
      </div>
      <label htmlFor="sr-q" className="sr-only">
        Search products
      </label>
      <input id="sr-q" type="search" placeholder="Search product or SKU" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <DataTable
        minW={900}
        head={["Product", "Opening", "Purchases", "Sales", "Returns in", "To supplier", "Adjustments", "Closing", "Value"]}
        empty={data ? "No stock movements in this period." : "Loading…"}
        rows={items.map((i) => ({
          key: i.productId,
          cells: [
            <button key="n" type="button" onClick={() => { setLog(null); setDetail({ id: i.productId, name: i.name }); }} className="min-h-9 text-left font-semibold text-indigo hover:underline">
              {i.name}
              <span className="block text-xs font-normal text-muted">{i.unit}</span>
            </button>,
            formatQty(i.opening),
            q(i.purchases),
            q(i.sales),
            q(i.returns),
            q(i.supplierReturns),
            q(i.adjustments),
            <strong key="c" className={i.closing < 0 ? "text-[#A3361F]" : ""}>{formatQty(i.closing)}</strong>,
            i.value === null ? "—" : formatMoney(i.value),
          ],
        }))}
      />
      {detail ? (
        <Modal title={`${detail.name}: movements`} onClose={() => setDetail(null)} wide>
          {!log ? <p className="text-muted">Loading…</p> : null}
          {log ? (
            <DataTable
              minW={560}
              left={2}
              head={["When", "What", "Change", "Stock after"]}
              empty="No movements in this period."
              rows={log.map((l) => ({ key: l.id, cells: [formatDate(l.createdAt, tz), <span key="w" className="flex flex-col"><span>{TYPE[l.type] ?? l.type}</span><span className="text-xs text-muted">{[l.note, l.userName].filter(Boolean).join(" · ")}</span></span>, q(l.changeMilli), formatQty(l.stockAfterMilli)] }))}
            />
          ) : null}
        </Modal>
      ) : null}
    </div>
  );
}
