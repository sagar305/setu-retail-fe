import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useCacheRefresh } from "../../hooks/useCacheRefresh";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { BranchSelect } from "../../components/BranchSelect";
import { useBranchChoice } from "../../hooks/useBranchChoice";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, SelectField } from "../../components/ui";
import { useSettings, useTaxWords } from "../../hooks/useSettings";
import { newUuid, saveChange } from "../../lib/changes";
import { ApiError, apiGet, type Product, type Purchase, type PurchaseSummary, type Supplier } from "../../lib/api";
import { productTaxes, taxesLabel, taxWordsFor } from "../../lib/taxWords";
import { useTaxGroups } from "../../hooks/useTaxGroups";
import { computePurchase } from "../../lib/books";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage, formatDate } from "../../lib/format";
import { stateLabel } from "../../lib/gstStates";
import { bpToPercent, currencySign, formatMoney, formatQty, parseMoney, parseQty } from "../../lib/money";
import { shopDay } from "../../lib/ranges";
import { useMoneyMethods } from "../../hooks/useMoneyMethods";
import { SupplierForm } from "./Suppliers";

const RATES = [0, 500, 1200, 1800, 2800];

type Line = { key: string; productId: string | null; name: string; qty: string; cost: string; rateBp: number; groupId: string; batchNo: string; expiry: string };
const blankLine = (): Line => ({ key: crypto.randomUUID(), productId: null, name: "", qty: "1", cost: "", rateBp: 0, groupId: "", batchNo: "", expiry: "" });

/** Purchase Register: supplier bills. */
export function PurchasesPage() {
  const words = useTaxWords();
  const me = useMe();
  const tz = me.account.timezone;
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ totals: { bills: number; total: number; inputGst: number }; purchases: PurchaseSummary[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState(0);
  useEffect(() => {
    const t = window.setTimeout(() => {
      apiGet<NonNullable<typeof data>>(`/purchases?q=${encodeURIComponent(q)}`).then(setData, (e: unknown) => setError(errorMessage(e)));
    }, 200);
    return () => window.clearTimeout(t);
  }, [q, fresh]);
  const bump = useCallback(() => setFresh((n) => n + 1), []);
  useCacheRefresh(["/purchases?"], bump);
  return (
    <div className="w-full">
      <PageHeader
        title="Purchase Register"
        description={`Supplier bills: stock goes up, cost prices update and input ${words.tax} is recorded.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!data?.purchases.length} onClick={() => downloadCsv("Purchases.csv", toCsv(["Bill date", "Supplier", "Bill no.", "Taxable", "CGST", "SGST", "IGST", words.tax, "Total", "Paid", "Returned", "Status"], (data?.purchases ?? []).map((p) => [p.billDate, p.supplierName, p.billNumber, (p.taxableTotal / 100).toFixed(2), (p.cgstTotal / 100).toFixed(2), (p.sgstTotal / 100).toFixed(2), (p.igstTotal / 100).toFixed(2), ((p.total - p.taxableTotal) / 100).toFixed(2), (p.total / 100).toFixed(2), (p.paidAmount / 100).toFixed(2), (p.returnedTotal / 100).toFixed(2), p.cancelledAt ? "Cancelled" : ""])))}>
              Export CSV
            </Button>
            <Link to="/tools/purchases/new" className="inline-flex min-h-11 items-center rounded-[10px] bg-indigo px-4 text-sm font-semibold text-white no-underline">
              Enter a supplier bill
            </Link>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="Bills" value={data?.totals.bills ?? 0} />
        <Stat label={`Bought (incl. ${words.tax})`} value={formatMoney(data?.totals.total ?? 0)} />
        <Stat label={`Input ${words.tax}`} value={formatMoney(data?.totals.inputGst ?? 0)} />
      </div>
      <label htmlFor="pu-q" className="sr-only">
        Search bills
      </label>
      <input id="pu-q" type="search" placeholder="Search supplier or bill number" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <DataTable
        minW={720}
        left={3}
        head={["Bill date", "Supplier", "Bill no.", `Input ${words.tax}`, "Total", "Paid"]}
        empty={data ? "No supplier bills yet." : "Loading…"}
        rows={(data?.purchases ?? []).map((p) => ({
          key: p.id,
          muted: Boolean(p.cancelledAt),
          cells: [
            formatDate(`${p.billDate}T12:00:00Z`, tz),
            <Link key="s" to={`/tools/purchases/${p.id}`} className="font-semibold">
              {p.supplierName}
            </Link>,
            <span key="b">
              {p.billNumber} {p.imported ? <Badge tone="muted">imported</Badge> : null}
            </span>,
            formatMoney(p.total - p.taxableTotal),
            formatMoney(p.total),
            p.paidAmount >= p.total ? "Paid" : p.paidAmount ? `${formatMoney(p.paidAmount)} paid` : "On credit",
          ],
        }))}
      />
    </div>
  );
}

/** Enter a supplier bill. */
export function NewPurchasePage() {
  const me = useMe();
  const settings = useSettings();
  const navigate = useNavigate();
  const today = shopDay(new Date(), me.account.timezone);
  const [branch, setBranch] = useBranchChoice();
  const methods = useMoneyMethods();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [billNumber, setBillNumber] = useState("");
  const [billDate, setBillDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [paidMode, setPaidMode] = useState<"all" | "credit" | "part">("all");
  const [paid, setPaid] = useState("");
  const [methodId, setMethodId] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const id = useMemo(() => crypto.randomUUID(), []);
  const batches = Boolean(settings?.batchTracking);
  const words = taxWordsFor(settings);
  const { groups } = useTaxGroups(words.custom);
  /** Custom taxes: the line's chosen group, else its product's group (or the default). */
  const lineTaxes = (l: Line) => {
    if (!words.custom) return undefined;
    const g = l.groupId ? groups.find((x) => x.id === l.groupId) : undefined;
    return g ? g.taxes : (productTaxes("CUSTOM", products.find((p) => p.id === l.productId)?.taxGroupId, groups) ?? []);
  };

  useEffect(() => {
    apiGet<{ suppliers: Supplier[] }>("/suppliers").then((r) => setSuppliers(r.suppliers), () => {});
  }, []);
  useEffect(() => {
    if (branch) apiGet<{ products: Product[] }>(`/products?branchId=${branch.id}&limit=2000`).then((r) => setProducts(r.products), () => {});
  }, [branch]);
  const effectiveMethod = methodId || methods.find((m) => m.kind === "CASH")?.id || methods[0]?.id || "";
  const supplier = suppliers.find((s) => s.id === supplierId);
  const interState = !words.custom && Boolean(branch?.stateCode && supplier?.stateCode && branch.stateCode !== supplier.stateCode);
  const byName = useMemo(() => new Map(products.map((p) => [p.name.toLowerCase(), p])), [products]);

  const parsed = lines.map((l) => ({ l, qtyMilli: parseQty(l.qty), unitCost: parseMoney(l.cost) }));
  const ready = parsed.filter((p) => p.l.name.trim() && p.qtyMilli && p.qtyMilli > 0 && p.unitCost !== null);
  const bill = computePurchase(ready.map((p) => ({ qtyMilli: p.qtyMilli!, unitCost: p.unitCost!, gstRateBp: p.l.rateBp, taxes: lineTaxes(p.l) })), interState);
  const paidPaise = paidMode === "all" ? bill.total : paidMode === "credit" ? 0 : (parseMoney(paid) ?? 0);

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  function pickName(key: string, name: string) {
    const p = byName.get(name.trim().toLowerCase());
    setLine(key, p ? { name: p.name, productId: p.id, rateBp: p.gstRateBp, groupId: "", cost: p.costPrice ? String(p.costPrice / 100) : "" } : { name, productId: null });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!branch || !supplierId) return;
    setBusy(true);
    setError(null);
    try {
      // Saved on this device at once; stock and the supplier's balance update when the cloud has it (Phase 9b).
      const body = {
        id,
        branchId: branch.id,
        supplierId,
        billNumber: billNumber.trim(),
        billDate,
        dueDate: paidPaise < bill.total && dueDate ? dueDate : null,
        lines: ready.map((p) => ({ productId: p.l.productId, name: p.l.name.trim(), qtyMilli: p.qtyMilli!, unitCost: p.unitCost!, gstRateBp: p.l.rateBp, ...(words.custom ? { taxes: lineTaxes(p.l) } : {}), batchNo: p.l.batchNo || undefined, expiry: p.l.expiry || null })),
        paidAmount: paidPaise,
        paidMethodId: paidPaise > 0 ? effectiveMethod : null,
        notes,
        expectedTotal: bill.total,
      };
      const supplierName = suppliers.find((x) => x.id === supplierId)?.name ?? "";
      const summary = { id, branchId: branch.id, supplierId, supplierName, billNumber: body.billNumber, billDate, dueDate: body.dueDate, interState: false, taxableTotal: bill.taxableTotal, cgstTotal: 0, sgstTotal: 0, igstTotal: 0, total: bill.total, paidAmount: paidPaise, paidMethodName: "", returnedTotal: 0, notes, stockApplied: false, imported: false, cancelledAt: null, cancelReason: "", createdAt: new Date().toISOString() };
      await saveChange({ method: "POST", path: "/purchases", body, label: `Supplier bill ${body.billNumber} · ${supplierName}`, effects: [{ kind: "insert", into: "/purchases?", key: "purchases", item: summary }] });
      navigate("/tools/purchases", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError && err.code === "total_mismatch" ? "The server worked the bill out differently. Check the lines and save again." : errorMessage(err));
      setBusy(false);
    }
  }

  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  const canSave = supplierId && billNumber.trim() && ready.length > 0 && ready.length === lines.filter((l) => l.name.trim()).length && paidPaise <= bill.total && (paidPaise === 0 || effectiveMethod);
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-5" noValidate>
      <PageHeader title="Enter a supplier bill" description={`Type costs before ${words.tax}, as printed on the supplier's bill.`} actions={<BranchSelect value={branch.id} onChange={setBranch} />} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex flex-col gap-1.5">
            <SelectField label="Supplier" value={supplierId} onChange={(e) => (e.target.value === "+" ? setAdding(true) : setSupplierId(e.target.value))}>
              <option value="">Pick a supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value="+">+ New supplier…</option>
            </SelectField>
            {supplier && !words.custom ? <span className="text-[13px] text-muted">{supplier.stateCode ? `${stateLabel(supplier.stateCode)} · ${interState ? "IGST" : "CGST + SGST"}` : "No GST state: CGST + SGST"}</span> : null}
          </div>
          <Field label="Bill number" value={billNumber} onChange={(e) => setBillNumber(e.target.value)} />
          <Field label="Bill date" type="date" max={today} value={billDate} onChange={(e) => setBillDate(e.target.value)} />
          <Field label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Card>

      <Card>
        <h2 className="mt-0 mb-3 text-base font-semibold">Items</h2>
        <datalist id="purchase-products">
          {products.map((p) => (
            <option key={p.id} value={p.name} />
          ))}
        </datalist>
        <div className="flex flex-col gap-3">
          {lines.map((l, i) => {
            const amt = ready.findIndex((p) => p.l.key === l.key);
            const a = amt >= 0 ? bill.lines[amt] : undefined;
            const product = l.productId ? products.find((p) => p.id === l.productId) : undefined;
            return (
              <div key={l.key} className="flex flex-wrap items-end gap-3 border-b border-cream pb-3">
                <Field label={`Item ${i + 1}`} list="purchase-products" value={l.name} onChange={(e) => pickName(l.key, e.target.value)} className="min-w-[220px] flex-[3_1_220px]" hint={product ? `In stock: ${formatQty(product.stockMilli)} ${product.unit}` : l.name ? "Not in Products: no stock change" : undefined} />
                <Field label={`Qty${product ? ` (${product.unit})` : ""}`} inputMode="decimal" value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} className="w-24" />
                <Field label={`Cost / unit (${currencySign()})`} inputMode="decimal" value={l.cost} onChange={(e) => setLine(l.key, { cost: e.target.value })} className="w-32" />
                {words.custom ? (
                  <SelectField label="Tax" value={l.groupId} onChange={(e) => setLine(l.key, { groupId: e.target.value })}>
                    <option value="">{product ? "Product's group" : "Default group"}: {taxesLabel(productTaxes("CUSTOM", product?.taxGroupId, groups) ?? [])}</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}: {taxesLabel(g.taxes)}
                      </option>
                    ))}
                  </SelectField>
                ) : (
                  <SelectField label={words.tax} value={l.rateBp} onChange={(e) => setLine(l.key, { rateBp: Number(e.target.value) })}>
                    {[...new Set([...RATES, l.rateBp])].map((r) => (
                      <option key={r} value={r}>
                        {bpToPercent(r)}%
                      </option>
                    ))}
                  </SelectField>
                )}
                {batches && product?.trackStock ? (
                  <>
                    <Field label="Batch no." value={l.batchNo} onChange={(e) => setLine(l.key, { batchNo: e.target.value })} className="w-28" />
                    <Field label="Expiry" type="date" value={l.expiry} onChange={(e) => setLine(l.key, { expiry: e.target.value })} className="w-40" />
                  </>
                ) : null}
                <span className="ml-auto flex min-h-12 flex-col items-end justify-center text-sm">
                  <strong>{a ? formatMoney(a.total) : "—"}</strong>
                  {a && a.total - a.taxable ? <span className="text-xs text-muted">{words.tax} {formatMoney(a.total - a.taxable)}</span> : null}
                </span>
                {lines.length > 1 ? (
                  <Button variant="ghost" aria-label={`Remove item ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
        <Button variant="secondary" className="mt-3" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          Add item
        </Button>
      </Card>

      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex-[1_1_320px]">
          <h2 className="mt-0 mb-3 text-base font-semibold">Payment</h2>
          <div role="group" aria-label="Paid" className="mb-3 grid grid-cols-3 gap-2">
            {(
              [
                ["all", "Paid in full"],
                ["part", "Part paid"],
                ["credit", "On credit"],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" aria-pressed={paidMode === k} onClick={() => setPaidMode(k)} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${paidMode === k ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
                {label}
              </button>
            ))}
          </div>
          {paidMode === "part" ? <Field label={`Paid now (${currencySign()})`} inputMode="decimal" value={paid} onChange={(e) => setPaid(e.target.value)} error={paidPaise > bill.total ? "More than the bill." : undefined} /> : null}
          {paidPaise > 0 ? (
            <div role="group" aria-label="Paid by" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {methods.map((m) => (
                <button key={m.id} type="button" aria-pressed={m.id === effectiveMethod} onClick={() => setMethodId(m.id)} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${m.id === effectiveMethod ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
                  {m.name}
                </button>
              ))}
            </div>
          ) : null}
          {paidPaise < bill.total ? <Field label="Due by (optional)" type="date" min={billDate} value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-3" hint={`${formatMoney(bill.total - paidPaise)} goes to the Supplier Ledger.`} /> : null}
        </Card>
        <Card className="flex-[1_1_300px]">
          <dl className="m-0 flex flex-col gap-1.5 text-sm">
            {[
              ["Taxable value", bill.taxableTotal],
              ...(words.custom
                ? bill.taxTotals.map((x) => [`${x.name} ${bpToPercent(x.rateBp)}%`, x.amount] as const)
                : interState
                ? [["IGST", bill.igstTotal] as const]
                : [
                    ["CGST", bill.cgstTotal] as const,
                    ["SGST", bill.sgstTotal] as const,
                  ]),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-muted">{k}</dt>
                <dd className="m-0">{formatMoney(v as number)}</dd>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
              <dt className="text-[15px] font-semibold">Bill total</dt>
              <dd className="m-0 text-2xl font-bold text-indigo">{formatMoney(bill.total)}</dd>
            </div>
          </dl>
          <Button type="submit" busy={busy} disabled={!canSave} className="mt-4 h-[52px] w-full text-base">
            Save bill · stock in
          </Button>
        </Card>
      </div>
      {adding ? (
        <SupplierForm
          supplier={null}
          onClose={() => setAdding(false)}
          onDone={(s) => {
            setSuppliers((x) => [...x, s].sort((a, b) => a.name.localeCompare(b.name)));
            setSupplierId(s.id);
            setAdding(false);
          }}
        />
      ) : null}
    </form>
  );
}

function ReturnDialog({ p, onDone, onClose }: { p: Purchase; onDone: (p: Purchase) => void; onClose: () => void }) {
  const [mode, setMode] = useState<"CREDIT_NOTE" | "REPLACEMENT">("CREDIT_NOTE");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = p.items.filter((i) => i.qtyMilli > i.returnedQtyMilli);
  const chosen = items.flatMap((i) => {
    const q = parseQty(qty[i.id] ?? "");
    return q && q > 0 ? [{ purchaseItemId: i.id, qtyMilli: q }] : [];
  });
  const tooMany = items.some((i) => (parseQty(qty[i.id] ?? "") ?? 0) > i.qtyMilli - i.returnedQtyMilli);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await saveChange({ method: "POST", path: `/purchases/${p.id}/returns`, body: { id: newUuid(), mode, items: chosen, note }, label: `Return goods on bill ${p.billNumber}` });
      onDone(p);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title={`Return goods · ${p.billNumber}`} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div role="group" aria-label="Supplier settles by" className="grid grid-cols-2 gap-2">
          {(
            [
              ["CREDIT_NOTE", "Credit note", "Reduces what you owe"],
              ["REPLACEMENT", "Replacement", "Same goods come back later"],
            ] as const
          ).map(([k, label, hint]) => (
            <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} className={`flex min-h-14 flex-col items-start justify-center rounded-[10px] px-3 text-left text-sm ${mode === k ? "border-2 border-indigo bg-indigo-50 text-indigo" : "border border-line bg-white"}`}>
              <strong>{label}</strong>
              <span className="text-xs text-muted">{hint}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {items.map((i) => (
            <div key={i.id} className="flex flex-wrap items-end gap-3 border-b border-cream pb-2">
              <span className="min-w-[180px] flex-1 text-sm">
                <strong>{i.name}</strong>
                <span className="block text-xs text-muted">
                  Bought {formatQty(i.qtyMilli)} {i.unit}
                  {i.returnedQtyMilli ? `, ${formatQty(i.returnedQtyMilli)} returned` : ""}
                </span>
              </span>
              <Field label="Return qty" inputMode="decimal" value={qty[i.id] ?? ""} onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })} className="w-28" />
            </div>
          ))}
        </div>
        <Field label="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Damaged, near expiry" />
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!chosen.length || tooMany}>
            Return · stock out
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function PurchaseDetailPage() {
  const words = useTaxWords();
  const { id = "" } = useParams();
  const me = useMe();
  const tz = me.account.timezone;
  const [p, setP] = useState<Purchase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "return">(null);
  const load = useCallback(() => {
    apiGet<{ purchase: Purchase }>(`/purchases/${id}`).then((r) => setP(r.purchase), (e: unknown) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  async function cancel() {
    const reason = window.prompt("Why cancel this bill? Its stock comes back out.");
    if (!reason) return;
    try {
      const cancelled = { cancelledAt: new Date().toISOString(), cancelReason: reason };
      await saveChange({ method: "POST", path: `/purchases/${id}/cancel`, body: { reason }, label: "Cancel a supplier bill", effects: [{ kind: "update", id: id!, fields: cancelled }] });
      if (p) setP({ ...p, ...cancelled });
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  async function receive(returnId: string) {
    try {
      await saveChange({ method: "POST", path: `/purchase-returns/${returnId}/receive`, label: "Replacement goods received" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!p) return error ? <Alert tone="error">{error}</Alert> : <p className="text-muted">Loading…</p>;
  const tax = p.total - p.taxableTotal;
  const canReturn = !p.cancelledAt && p.items.some((i) => i.qtyMilli > i.returnedQtyMilli);
  return (
    <div className="w-full">
      <PageHeader
        title={`${p.supplierName} · ${p.billNumber}`}
        description={`Bill date ${formatDate(`${p.billDate}T12:00:00Z`, tz)}${p.dueDate ? ` · due ${formatDate(`${p.dueDate}T12:00:00Z`, tz)}` : ""}${p.imported ? " · imported from the free POS" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/tools/purchases" className="flex min-h-11 items-center px-2 text-sm font-semibold text-indigo">
              All bills
            </Link>
            {canReturn ? (
              <Button variant="secondary" onClick={() => setDialog("return")}>
                Return goods
              </Button>
            ) : null}
            {!p.cancelledAt && !p.returns.length ? (
              <Button variant="danger" onClick={() => void cancel()}>
                Cancel bill
              </Button>
            ) : null}
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {p.cancelledAt ? <Alert tone="warn">Cancelled on {formatDate(p.cancelledAt, tz)}: {p.cancelReason}</Alert> : null}
      <div className="my-4 flex flex-wrap gap-3">
        <Stat label="Bill total" value={formatMoney(p.total)} />
        <Stat label={p.taxMode === "CUSTOM" ? p.taxTotals.map((x) => x.name).filter((n, i, a) => a.indexOf(n) === i).join(" + ") || words.tax : p.interState ? "IGST" : "CGST + SGST"} value={formatMoney(tax)} />
        <Stat label="Paid with the bill" value={p.paidAmount ? `${formatMoney(p.paidAmount)} · ${p.paidMethodName}` : "Nothing (credit)"} />
        {p.returnedTotal ? <Stat label="Credit notes" value={formatMoney(p.returnedTotal)} /> : null}
      </div>
      <DataTable
        minW={720}
        left={1}
        head={["Item", "Qty", "Cost / unit", words.tax, "Taxable", "Tax", "Total"]}
        rows={p.items.map((i) => ({
          key: i.id,
          cells: [
            <span key="n" className="flex flex-col">
              <strong>{i.name}</strong>
              <span className="text-xs text-muted">{[i.hsn && words.code && `${words.code} ${i.hsn}`, i.batchNo && `Batch ${i.batchNo}`, i.expiry && `exp ${i.expiry}`, i.returnedQtyMilli && `${formatQty(i.returnedQtyMilli)} returned`, !i.productId && "no stock change"].filter(Boolean).join(" · ")}</span>
            </span>,
            `${formatQty(i.qtyMilli)} ${i.unit}`,
            formatMoney(i.unitCost),
            i.taxes.length ? taxesLabel(i.taxes) : `${bpToPercent(i.gstRateBp)}%`,
            formatMoney(i.taxable),
            formatMoney(i.total - i.taxable),
            formatMoney(i.total),
          ],
        }))}
      />
      {p.returns.length ? (
        <section className="mt-5 flex flex-col gap-2">
          <h2 className="m-0 text-base font-semibold">Returned to the supplier</h2>
          {p.returns.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-center gap-3">
                <strong>{r.mode === "CREDIT_NOTE" ? "Credit note" : "Replacement"}</strong>
                <Badge tone={r.status === "PENDING" ? "warn" : "ok"}>{r.status === "PENDING" ? "Waiting for goods" : r.status === "RECEIVED" ? "Received" : "Settled"}</Badge>
                <span className="text-sm text-muted">{formatDate(r.occurredAt, tz)}</span>
                <span className="ml-auto font-semibold">{formatMoney(r.total)}</span>
                {r.status === "PENDING" ? <Button onClick={() => void receive(r.id)}>Replacement arrived</Button> : null}
              </div>
              <p className="m-0 mt-2 text-sm text-muted">
                {r.items.map((x) => `${x.name} × ${formatQty(x.qtyMilli)}`).join(", ")}
                {r.note ? ` · ${r.note}` : ""}
              </p>
            </Card>
          ))}
        </section>
      ) : null}
      {dialog === "return" ? (
        <ReturnDialog
          p={p}
          onClose={() => setDialog(null)}
          onDone={(x) => {
            setP(x);
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
