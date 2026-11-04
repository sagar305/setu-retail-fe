import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSessionInfo } from "../auth/sessionInfo";
import { useSync } from "../offline/SyncProvider";
import { db } from "../offline/db";
import { deviceKeyFor, ensureCounter, invoiceNumber, peekSeq, takeSeq } from "../offline/counter";
import { refreshPack, storedPack } from "../offline/pack";
import { pendingOrders, queueCustomer, queueOrder } from "../offline/outbox";
import { readPref } from "../lib/storage";
import { Alert, Badge, Button, Field, Modal } from "../components/ui";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { ApiError, apiDelete, apiGet, apiPost, type Customer, type HeldCart, type OfflinePack, type Order, type PaymentMethod, type Product } from "../lib/api";
import { rememberBranch } from "../lib/branch";
import { errorMessage } from "../lib/format";
import { computeBill, placeOfSupply, type Discount } from "../lib/gst";
import { bpToPercent, formatMoney, formatQty, parseMoney, parseQty } from "../lib/money";
import { CustomerPicker } from "../pos/CustomerPicker";
import { Receipt } from "../pos/Receipt";
import { BatchPicker } from "../pos/Batches";
import { fmtDay } from "../lib/batches";

type Line = { productId: string; qtyMilli: number; batchId?: string | null };

type Setup = { pack: OfflinePack; counterId: string; stale: boolean };

/** Builds what the receipt shows for a bill saved on this device. */
function localOrder(args: { id: string; number: string; createdAt: string; pack: OfflinePack; cashierId: string; cashierName: string; customer: Customer | null; discount: Discount; bill: ReturnType<typeof computeBill> & { interState: boolean; placeOfSupply: string | null }; lines: (Line & { product: Product })[]; method: PaymentMethod }): Order {
  const { pack, bill } = args;
  return {
    id: args.id,
    invoiceNumber: args.number,
    status: "COMPLETED",
    createdAt: args.createdAt,
    branch: pack.branch,
    counter: { code: pack.counter.code, name: pack.counter.name },
    cashierId: args.cashierId,
    cashierName: args.cashierName,
    customer: args.customer ? { id: args.customer.id, name: args.customer.name, phone: args.customer.phone, gstin: args.customer.gstin } : null,
    placeOfSupply: bill.placeOfSupply,
    interState: bill.interState,
    taxEnabled: pack.settings.taxEnabled,
    discount: args.discount,
    subtotal: bill.subtotal,
    discountTotal: bill.discountTotal,
    taxableTotal: bill.taxableTotal,
    cgstTotal: bill.cgstTotal,
    sgstTotal: bill.sgstTotal,
    igstTotal: bill.igstTotal,
    total: bill.total,
    returnedTotal: 0,
    note: "",
    cancelledAt: null,
    cancelReason: "",
    offline: true,
    priceDiffers: false,
    items: bill.lines.map((l, i) => {
      const line = args.lines[i]!;
      const batch = line.batchId ? pack.batches.find((b) => b.id === line.batchId) : undefined;
      return {
        id: crypto.randomUUID(),
        productId: line.product.id,
        name: line.product.name,
        hsn: line.product.hsn,
        unit: line.product.unit,
        qtyMilli: l.qtyMilli,
        unitPrice: l.unitPrice,
        gstRateBp: l.gstRateBp,
        taxInclusive: l.taxInclusive,
        gross: l.gross,
        discount: l.discount,
        taxable: l.taxable,
        cgst: l.cgst,
        sgst: l.sgst,
        igst: l.igst,
        total: l.total,
        returnedQtyMilli: 0,
        batches: batch ? [{ batchNo: batch.batchNo, expiry: batch.expiry, qtyMilli: l.qtyMilli }] : [],
      };
    }),
    payments: [{ methodId: args.method.id, methodName: args.method.name, kind: args.method.kind, amount: bill.total }],
    creditNotes: [],
  };
}

export function BillingPage() {
  const s = useSessionInfo();
  const online = useOnlineStatus();
  const sync = useSync();
  const [branch, setBranch] = useState(() => {
    const saved = readPref("setu-retail:branch");
    return s.branches.find((b) => b.id === saved) ?? s.branches[0] ?? null;
  });
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [pendingQty, setPendingQty] = useState<Map<string, number>>(new Map());
  const [queuedCustomers, setQueuedCustomers] = useState<Customer[]>([]);

  const [lines, setLines] = useState<Line[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [discount, setDiscount] = useState<Discount>({ type: "flat", value: 0 });
  const [methodId, setMethodId] = useState<string | null>(null);
  const [tendered, setTendered] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<null | "customer" | "discount" | "hold" | "held">(null);
  const [pickBatchFor, setPickBatchFor] = useState<string | null>(null);
  const [done, setDone] = useState<{ order: Order; queued: boolean } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Set up this device as a counter and get its offline pack. Online: register
  // if needed and download a fresh pack. Offline: use the pack saved here.
  useEffect(() => {
    if (!branch) return;
    let alive = true;
    (async () => {
      const saved = await storedPack(branch.id);
      if (saved && alive) setSetup({ pack: saved, counterId: saved.counter.id, stale: true });
      if (s.mode === "online") {
        try {
          const counter = await ensureCounter(branch.id);
          const key = (await deviceKeyFor(counter.id))!;
          const pack = await refreshPack(branch.id, key);
          if (alive) setSetup({ pack, counterId: counter.id, stale: false });
          return;
        } catch (err) {
          if (!(err instanceof TypeError) && alive && !saved) setSetupError(errorMessage(err));
        }
      }
      if (!saved && alive) setSetupError("This counter can't bill offline yet: open Billing once while online.");
    })();
    return () => {
      alive = false;
    };
  }, [branch, s.mode, version]);

  // What's waiting to sync from this counter: its stock is already taken here.
  const counterId = setup?.counterId;
  useEffect(() => {
    if (!counterId) return;
    let alive = true;
    Promise.all([pendingOrders(counterId), db.customers.where("counterId").equals(counterId).toArray()]).then(([orders, custs]) => {
      if (!alive) return;
      const m = new Map<string, number>();
      for (const o of orders) for (const l of o.payload.lines) if (l.productId) m.set(l.productId, (m.get(l.productId) ?? 0) + l.qtyMilli);
      setPendingQty(m);
      setQueuedCustomers(custs.map((c) => ({ id: c.id, name: c.payload.name, phone: c.payload.phone ?? "", email: "", address: "", gstin: c.payload.gstin ?? null, stateCode: c.payload.stateCode ?? null, notes: "", createdAt: c.createdAt })));
    });
    return () => {
      alive = false;
    };
  }, [counterId, sync.pending, done]);

  const pack = setup?.pack;
  const settings = pack?.settings;
  const methods = pack?.methods ?? [];
  const products = useMemo(() => (pack?.products ?? []).map((p) => (pendingQty.has(p.id) && p.trackStock ? { ...p, stockMilli: p.stockMilli - pendingQty.get(p.id)! } : p)), [pack, pendingQty]);
  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const activeMethodId = methodId ?? methods.find((m) => m.kind === "UPI")?.id ?? methods[0]?.id ?? null;
  const method = methods.find((m) => m.id === activeMethodId);
  const isCashier = s.user.role === "CASHIER";
  const canTryOnline = s.mode === "online" && online;

  const bill = useMemo(() => {
    const priced = lines.filter((l) => byId.has(l.productId));
    const pos = placeOfSupply(settings?.taxEnabled ? (pack?.branch.stateCode ?? null) : null, settings?.taxEnabled ? (customer?.stateCode ?? null) : null);
    return {
      ...computeBill(
        priced.map((l) => {
          const p = byId.get(l.productId)!;
          return { unitPrice: p.price, qtyMilli: l.qtyMilli, gstRateBp: p.gstRateBp, taxInclusive: p.taxInclusive };
        }),
        discount,
        { taxEnabled: Boolean(settings?.taxEnabled), interState: pos.interState },
      ),
      interState: pos.interState,
      placeOfSupply: pos.placeOfSupply,
    };
  }, [lines, byId, discount, settings, pack, customer]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => (!categoryId || p.categoryId === categoryId) && (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase() === q || p.barcode === search.trim()));
  }, [products, search, categoryId]);

  const add = useCallback((p: Product, qtyMilli = 1000) => {
    setDone(null);
    setLines((ls) => {
      const i = ls.findIndex((l) => l.productId === p.id);
      if (i === -1) return [...ls, { productId: p.id, qtyMilli }];
      return ls.map((l, j) => (j === i ? { ...l, qtyMilli: l.qtyMilli + qtyMilli } : l));
    });
  }, []);
  const setQty = (productId: string, qtyMilli: number) =>
    setLines((ls) => (qtyMilli <= 0 ? ls.filter((l) => l.productId !== productId) : ls.map((l) => (l.productId === productId ? { ...l, qtyMilli } : l))));

  function onSearchEnter() {
    const exact = products.find((p) => (p.barcode && p.barcode === search.trim()) || (p.sku && p.sku.toLowerCase() === search.trim().toLowerCase()));
    const pick = exact ?? (visible.length === 1 ? visible[0] : undefined);
    if (pick) {
      add(pick);
      setSearch("");
    }
  }

  function reset() {
    setLines([]);
    setCustomer(null);
    setDiscount({ type: "flat", value: 0 });
    setTendered("");
    setError(null);
  }

  async function charge() {
    if (!branch || !setup || !pack || !method) return;
    setBusy(true);
    setError(null);
    const id = crypto.randomUUID();
    const n = await peekSeq(setup.counterId, pack.counter.nextInvoiceNumber);
    const number = invoiceNumber(pack.branch.code, pack.counter.code, n);
    const createdAt = new Date().toISOString();
    const priced = lines.filter((l) => byId.has(l.productId)).map((l) => ({ ...l, product: byId.get(l.productId)! }));
    try {
      // Online with nothing waiting: the server checks and saves the bill now.
      if (canTryOnline && (await pendingOrders(setup.counterId)).length === 0) {
        try {
          const { order } = await apiPost<{ order: Order }>("/orders", {
            id,
            branchId: branch.id,
            counterId: setup.counterId,
            invoiceNumber: number,
            customerId: customer?.id ?? null,
            lines: priced.map((l) => ({ productId: l.productId, qtyMilli: l.qtyMilli, batchId: l.batchId ?? null })),
            discount,
            payments: [{ methodId: method.id, amount: bill.total }],
          });
          await takeSeq(setup.counterId, n);
          setDone({ order, queued: false });
          reset();
          setVersion((v) => v + 1);
          return;
        } catch (err) {
          if (err instanceof ApiError) {
            setError(err.code === "payment_mismatch" ? "Prices changed on the server. The counter has been refreshed: check the bill and charge again." : errorMessage(err));
            if (["payment_mismatch", "unknown_product", "out_of_stock", "invoice_number_used"].includes(err.code)) {
              if (err.code === "invoice_number_used") await takeSeq(setup.counterId, n);
              setVersion((v) => v + 1);
            }
            return;
          }
          // Network trouble: fall through and keep the bill on this counter, same id and number.
        }
      }
      if (!settings?.allowNegativeStock) {
        const short = priced.filter((l) => l.product.trackStock && l.product.stockMilli < l.qtyMilli);
        if (short.length) return setError(`Not enough stock: ${short.map((l) => l.product.name).join(", ")}.`);
      }
      const order = localOrder({ id, number, createdAt, pack, cashierId: s.user.id, cashierName: s.user.name, customer, discount, bill, lines: priced, method });
      await queueOrder({
        id,
        counterId: setup.counterId,
        branchId: branch.id,
        invoiceNumber: number,
        createdAt,
        order,
        payload: {
          id,
          cashierId: s.user.id,
          invoiceNumber: number,
          createdAt,
          customerId: customer?.id ?? null,
          taxEnabled: Boolean(settings?.taxEnabled),
          discount,
          lines: priced.map((l) => ({ productId: l.product.id, name: l.product.name, hsn: l.product.hsn, unit: l.product.unit, unitPrice: l.product.price, gstRateBp: l.product.gstRateBp, taxInclusive: l.product.taxInclusive, qtyMilli: l.qtyMilli, batchId: l.batchId ?? null })),
          payments: [{ methodId: method.id, amount: bill.total }],
          total: bill.total,
        },
      });
      await takeSeq(setup.counterId, n);
      setDone({ order, queued: true });
      reset();
      sync.kick();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      searchRef.current?.focus();
    }
  }

  if (!branch) return <Alert tone="warn">No branch is active for you on this plan. Ask the owner.</Alert>;
  if (setupError && !setup) return <Alert tone="error">{setupError}</Alert>;
  if (!setup || !pack || !settings) return <p className="text-muted">Getting the counter ready…</p>;

  const cash = method?.kind === "CASH";
  const tenderedPaise = parseMoney(tendered);
  const change = cash && tenderedPaise !== null ? tenderedPaise - bill.total : null;
  const tooMuchDiscount = isCashier && bill.subtotal > 0 && bill.discountTotal * 10_000 > settings.cashierMaxDiscountBp * bill.subtotal;
  const canCharge = lines.length > 0 && !busy && !tooMuchDiscount && Boolean(method) && (method?.kind !== "CREDIT" || customer !== null);
  const localCustomers = [...queuedCustomers, ...pack.customers];
  const offlineHere = !canTryOnline;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="mr-auto flex flex-col">
          <h1 className="m-0 text-2xl font-semibold">Billing</h1>
          <span className="text-sm text-muted">
            {pack.branch.name} ({pack.branch.code}) · {pack.counter.name} ({pack.counter.code})
          </span>
        </div>
        {s.branches.length > 1 && s.mode === "online" ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            Branch
            <select
              value={branch.id}
              onChange={(e) => {
                const b = s.branches.find((x) => x.id === e.target.value)!;
                rememberBranch(b.id);
                setBranch(b);
                setSetup(null);
                reset();
              }}
              className="h-11 rounded-[10px] border border-line-strong bg-white px-2 text-ink"
            >
              {s.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {canTryOnline ? (
          <HeldButton branchId={branch.id} open={dialog === "held"} onOpen={() => setDialog("held")} onClose={() => setDialog(null)} onRecall={async (cart) => {
            setLines(cart.payload.lines.filter((l) => byId.has(l.productId)));
            setDiscount(cart.payload.discount ?? { type: "flat", value: 0 });
            setCustomer(cart.payload.customerId ? (await apiGet<{ customer: Customer }>(`/customers/${cart.payload.customerId}`)).customer : null);
            await apiDelete(`/held-carts/${cart.id}`);
            setDialog(null);
          }} />
        ) : null}
      </div>
      {offlineHere ? (
        <Alert tone="warn">
          {online ? "Signed in offline." : "No internet."} Bills are saved on this counter with their own numbers and sync when the internet is back. Prices and stock are as of {new Date(pack.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Products" className="flex min-w-0 flex-[999_1_420px] flex-col gap-3">
          <label htmlFor="pos-search" className="sr-only">
            Search products
          </label>
          <input
            id="pos-search"
            ref={searchRef}
            type="search"
            autoFocus
            placeholder="Search name or SKU, or scan a barcode and press Enter"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchEnter()}
            className="h-12 rounded-[10px] border border-line-strong bg-white px-3.5 text-[15px] text-ink"
          />
          {pack.categories.length ? (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {[{ id: null, name: "All" }, ...pack.categories].map((c) => (
                <button
                  key={c.id ?? "all"}
                  type="button"
                  aria-pressed={categoryId === c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`min-h-9 rounded-full px-3.5 text-[13px] ${categoryId === c.id ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          ) : null}
          {products.length === 0 ? <Alert tone="info">No products yet. {isCashier ? "Ask a manager to add them." : "Add them under Products."}</Alert> : null}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
            {visible.map((p) => {
              const blocked = !settings.allowNegativeStock && p.trackStock && p.stockMilli <= (lines.find((l) => l.productId === p.id)?.qtyMilli ?? 0);
              const status = !p.trackStock ? "untracked" : p.stockMilli <= 0 ? "out" : p.stockStatus === "low" ? "low" : "ok";
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={blocked}
                  onClick={() => add(p)}
                  className="flex min-h-[116px] flex-col gap-1.5 rounded-xl border border-line bg-white p-3.5 text-left text-ink hover:border-indigo disabled:opacity-50"
                >
                  <span className="text-sm leading-tight font-semibold">{p.name}</span>
                  {settings.taxEnabled ? <span className="text-xs text-muted">GST {bpToPercent(p.gstRateBp)}%{p.hsn ? ` · HSN ${p.hsn}` : ""}</span> : null}
                  {settings.batchTracking && p.nextExpiry ? <ExpiryHint day={p.nextExpiry} timeZone={settings.business.timezone} /> : null}
                  <span className="mt-auto flex w-full items-baseline justify-between gap-2">
                    <span className="font-bold text-indigo">{formatMoney(p.price)}</span>
                    {p.trackStock ? (
                      <span className={`text-xs ${status === "out" ? "font-semibold text-[#A3361F]" : status === "low" ? "font-semibold text-warn" : "text-muted"}`}>
                        {status === "out" ? "Out of stock" : `${formatQty(p.stockMilli)} ${p.unit}`}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside aria-label="Current bill" className="flex w-full flex-[1_1_340px] flex-col overflow-hidden rounded-2xl border border-line bg-white lg:max-w-[420px]">
          <div className="flex flex-col gap-2.5 border-b border-cream px-4 py-3.5">
            <div className="flex items-center justify-between">
              <h2 className="m-0 text-base font-semibold">Current bill</h2>
              <span className="text-[13px] text-muted">{lines.length} item{lines.length === 1 ? "" : "s"}</span>
            </div>
            <button type="button" onClick={() => setDialog("customer")} className="min-h-11 rounded-[10px] border border-dashed border-line-strong bg-paper px-3 text-left text-sm">
              {customer ? (
                <>
                  <strong>{customer.name}</strong>
                  {customer.gstin ? ` · GSTIN ${customer.gstin}` : customer.phone ? ` · ${customer.phone}` : ""} <span className="text-indigo underline">change</span>
                </>
              ) : (
                "Customer: Walk-in · tap to add"
              )}
            </button>
          </div>
          <div className="flex flex-col px-4 py-1">
            {lines.map((l) => {
              const p = byId.get(l.productId);
              if (!p) return null;
              const i = bill.lines[lines.filter((x) => byId.has(x.productId)).indexOf(l)];
              return (
                <div key={l.productId} className="flex flex-col gap-2 border-b border-cream py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="shrink-0 text-sm font-semibold">{formatMoney(i?.total ?? 0)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex flex-col text-xs text-muted">
                      <span>
                        {formatMoney(p.price)}/{p.unit}
                        {settings.taxEnabled ? ` · GST ${bpToPercent(p.gstRateBp)}%` : ""}
                      </span>
                      {settings.batchTracking && p.trackStock ? (
                        <button type="button" onClick={() => setPickBatchFor(p.id)} className="min-h-7 self-start text-indigo underline">
                          {l.batchId ? "Batch: picked · change" : "Batch: earliest expiry · change"}
                        </button>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label={`One less ${p.name}`} onClick={() => setQty(p.id, l.qtyMilli - 1000)} className="size-9 rounded-lg border border-line bg-white">
                        −
                      </button>
                      <QtyInput label={`Quantity of ${p.name}`} milli={l.qtyMilli} onChange={(q) => setQty(p.id, q)} />
                      <button type="button" aria-label={`One more ${p.name}`} onClick={() => setQty(p.id, l.qtyMilli + 1000)} className="size-9 rounded-lg border border-line bg-white">
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {lines.length === 0 ? <p className="my-6 text-center text-sm text-muted">Tap a product or scan a barcode to start a bill.</p> : null}
          </div>
          <div className="flex flex-col gap-1.5 bg-paper px-4 py-3.5 text-[13px]">
            {bill.discountTotal > 0 ? <Line a="Subtotal" b={formatMoney(bill.subtotal)} /> : null}
            <div className="flex items-center justify-between">
              <span className="text-muted">Discount</span>
              <button type="button" onClick={() => setDialog("discount")} className="min-h-8 text-indigo underline">
                {bill.discountTotal > 0 ? `−${formatMoney(bill.discountTotal)}` : `Add${isCashier ? ` (max ${bpToPercent(settings.cashierMaxDiscountBp)}%)` : ""}`}
              </button>
            </div>
            {settings.taxEnabled ? (
              <>
                <Line a="Taxable value" b={formatMoney(bill.taxableTotal)} />
                {bill.interState ? (
                  <Line a="IGST" b={formatMoney(bill.igstTotal)} />
                ) : (
                  <>
                    <Line a="CGST" b={formatMoney(bill.cgstTotal)} />
                    <Line a="SGST" b={formatMoney(bill.sgstTotal)} />
                  </>
                )}
              </>
            ) : null}
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-[15px] font-semibold">Total{settings.taxEnabled ? " (incl. GST)" : ""}</span>
              <span className="text-2xl font-bold text-indigo">{formatMoney(bill.total)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 px-4 py-3.5">
            <div role="group" aria-label="Payment method" className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {methods.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={m.id === activeMethodId}
                  onClick={() => setMethodId(m.id)}
                  className={`min-h-11 rounded-[10px] px-2 text-[13px] ${m.id === activeMethodId ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}
                >
                  {m.kind === "CREDIT" ? "Udhaar" : m.name}
                </button>
              ))}
            </div>
            {cash ? (
              <div className="flex items-end gap-3">
                <Field label="Cash received" inputMode="decimal" value={tendered} onChange={(e) => setTendered(e.target.value)} className="flex-1" />
                <span className={`pb-3 text-sm font-semibold ${change !== null && change < 0 ? "text-[#A3361F]" : "text-ok"}`}>{change === null ? "" : change < 0 ? `Short ${formatMoney(-change)}` : `Change ${formatMoney(change)}`}</span>
              </div>
            ) : null}
            {method?.kind === "CREDIT" && !customer ? <Alert tone="warn">Pick a saved customer to sell on udhaar.</Alert> : null}
            {tooMuchDiscount ? <Alert tone="warn">Cashiers can give up to {bpToPercent(settings.cashierMaxDiscountBp)}% discount.</Alert> : null}
            {error ? <Alert tone="error">{error}</Alert> : null}
            <div className="flex gap-2.5">
              {canTryOnline ? (
                <Button variant="secondary" disabled={lines.length === 0} onClick={() => setDialog("hold")} className="h-[52px] flex-1">
                  Hold
                </Button>
              ) : null}
              <Button onClick={charge} busy={busy} disabled={!canCharge} className="h-[52px] flex-[2] text-base">
                Charge {formatMoney(bill.total)}
              </Button>
            </div>
          </div>
        </aside>
      </div>

      {pickBatchFor && byId.get(pickBatchFor) ? (
        <BatchPicker
          product={byId.get(pickBatchFor)!}
          branchId={branch.id}
          local={offlineHere ? pack.batches.filter((b) => b.productId === pickBatchFor) : undefined}
          current={lines.find((l) => l.productId === pickBatchFor)?.batchId ?? null}
          onClose={() => setPickBatchFor(null)}
          onPick={(id) => {
            setLines((ls) => ls.map((l) => (l.productId === pickBatchFor ? { ...l, batchId: id } : l)));
            setPickBatchFor(null);
          }}
        />
      ) : null}
      {dialog === "customer" ? (
        <CustomerPicker
          onClose={() => setDialog(null)}
          onPick={(c) => {
            setCustomer(c);
            setDialog(null);
          }}
          local={
            offlineHere
              ? {
                  customers: localCustomers,
                  add: async (form) => {
                    const id = crypto.randomUUID();
                    const createdAt = new Date().toISOString();
                    const g = form.gstin.trim().toUpperCase().replace(/\s/g, "");
                    await queueCustomer({ id, counterId: setup.counterId, createdAt, payload: { id, name: form.name.trim(), phone: form.phone.trim(), gstin: g || undefined, stateCode: g ? g.slice(0, 2) : undefined } });
                    const c: Customer = { id, name: form.name.trim(), phone: form.phone.replace(/\D/g, "").slice(-10), email: "", address: "", gstin: g || null, stateCode: g ? g.slice(0, 2) : null, notes: "", createdAt };
                    setQueuedCustomers((q) => [c, ...q]);
                    return c;
                  },
                }
              : undefined
          }
        />
      ) : null}
      {dialog === "discount" ? (
        <DiscountDialog
          current={discount}
          maxBp={isCashier ? settings.cashierMaxDiscountBp : null}
          onClose={() => setDialog(null)}
          onSave={(d) => {
            setDiscount(d);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === "hold" ? (
        <HoldDialog
          onClose={() => setDialog(null)}
          onSave={async (label) => {
            await apiPost("/held-carts", { branchId: branch.id, label, payload: { lines, customerId: customer?.id ?? null, discount } });
            reset();
            setDialog(null);
          }}
        />
      ) : null}
      {done ? (
        <Modal title={`Bill ${done.order.invoiceNumber} saved`} onClose={() => setDone(null)} wide>
          <div className="flex flex-col gap-4">
            {done.queued ? <Alert tone="info">Saved on this counter. It syncs automatically when the internet is back.</Alert> : null}
            <div className="max-h-[55vh] overflow-auto rounded-xl border border-line bg-cream p-3">
              <Receipt order={done.order} settings={settings} />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => window.print()}>Print receipt</Button>
              <Button variant="secondary" onClick={() => setDone(null)}>
                New bill
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function ExpiryHint({ day, timeZone }: { day: string; timeZone: string }) {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
  const days = Math.round((Date.parse(day) - Date.parse(today)) / 86_400_000);
  const tone = days < 0 ? "font-semibold text-[#A3361F]" : days <= 30 ? "font-semibold text-warn" : "text-muted";
  return <span className={`text-xs ${tone}`}>{days < 0 ? `Expired ${fmtDay(day)}` : `Exp ${fmtDay(day)}`}</span>;
}

function Line({ a, b }: { a: string; b: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{a}</span>
      <span>{b}</span>
    </div>
  );
}

function QtyInput({ milli, onChange, label }: { milli: number; onChange: (milli: number) => void; label: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text ?? formatQty(milli)}
      onFocus={(e) => {
        setText(formatQty(milli));
        e.target.select();
      }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const q = text === null ? null : parseQty(text);
        if (q !== null) onChange(q);
        setText(null);
      }}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-9 w-14 rounded-lg border border-line text-center text-sm font-semibold"
    />
  );
}

function DiscountDialog({ current, maxBp, onSave, onClose }: { current: Discount; maxBp: number | null; onSave: (d: Discount) => void; onClose: () => void }) {
  const [type, setType] = useState<Discount["type"]>(current.type);
  const [text, setText] = useState(current.value ? (current.type === "flat" ? String(current.value / 100) : String(current.value / 100)) : "");
  const parsed = parseMoney(text);
  const value = parsed ?? 0;
  const invalid = text !== "" && parsed === null;
  const over = type === "percent" && maxBp !== null && value > maxBp;
  return (
    <Modal title="Discount on this bill" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div role="group" aria-label="Discount type" className="grid grid-cols-2 gap-2">
          {(["flat", "percent"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-11 rounded-[10px] ${type === t ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line"}`}>
              {t === "flat" ? "Amount (₹)" : "Percent (%)"}
            </button>
          ))}
        </div>
        <Field
          label={type === "flat" ? "Discount in ₹" : "Discount in %"}
          inputMode="decimal"
          value={text}
          onChange={(e) => setText(e.target.value)}
          error={invalid ? "Enter a number." : over ? `Cashiers can give up to ${bpToPercent(maxBp!)}%.` : undefined}
          hint={maxBp !== null ? `You can give up to ${bpToPercent(maxBp)}%.` : "Applied before GST, shared across the items."}
        />
        <div className="flex gap-3">
          {/* parseMoney gives hundredths: ₹ → paise, % → basis points. */}
          <Button disabled={invalid || over} onClick={() => onSave({ type, value })}>
            Apply
          </Button>
          <Button variant="ghost" onClick={() => onSave({ type: "flat", value: 0 })}>
            Remove discount
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function HoldDialog({ onSave, onClose }: { onSave: (label: string) => Promise<void>; onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Hold this bill" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Name it so you can find it" placeholder="e.g. Lady in blue, Table 2" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button
          busy={busy}
          disabled={!label.trim()}
          onClick={async () => {
            setBusy(true);
            try {
              await onSave(label.trim());
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          Hold bill
        </Button>
      </div>
    </Modal>
  );
}

function HeldButton({ branchId, open, onOpen, onClose, onRecall }: { branchId: string; open: boolean; onOpen: () => void; onClose: () => void; onRecall: (c: HeldCart) => Promise<void> }) {
  const [carts, setCarts] = useState<HeldCart[]>([]);
  const load = useCallback(() => {
    apiGet<{ carts: HeldCart[] }>(`/held-carts?branchId=${branchId}`).then((r) => setCarts(r.carts), () => {});
  }, [branchId]);
  useEffect(load, [load, open]);
  return (
    <>
      <Button variant="secondary" onClick={onOpen}>
        Held bills <Badge tone="muted">{carts.length}</Badge>
      </Button>
      {open ? (
        <Modal title="Held bills" onClose={onClose}>
          {carts.length === 0 ? <p className="m-0 text-muted">No held bills.</p> : null}
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {carts.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => void onRecall(c)} className="flex min-h-12 w-full items-center justify-between rounded-xl border border-line px-3 py-2 text-left hover:border-indigo">
                  <span className="font-semibold">{c.label}</span>
                  <span className="text-xs text-muted">
                    {c.payload.lines.length} items · {new Date(c.createdAt).toLocaleTimeString("en-IN", { timeStyle: "short" })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      ) : null}
    </>
  );
}
