import { useCallback, useEffect, useState } from "react";
import { useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader, SelectField } from "../components/ui";
import { apiGet, apiPost, type Order, type OrderSummary, type PaymentMethod, type Settings } from "../lib/api";
import { currentBranch } from "../lib/branch";
import { ensureCounter } from "../lib/counter";
import { errorMessage } from "../lib/format";
import { formatMoney, formatQty, parseQty } from "../lib/money";
import { Receipt } from "../pos/Receipt";

function statusBadge(o: { status: string; returnedTotal: number; total: number }) {
  if (o.status === "CANCELLED") return <Badge tone="muted">Cancelled</Badge>;
  if (o.returnedTotal >= o.total && o.total > 0) return <Badge tone="warn">Returned</Badge>;
  if (o.returnedTotal > 0) return <Badge tone="warn">Part returned</Badge>;
  return <Badge tone="ok">Paid</Badge>;
}

function ReturnDialog({ order, methods, onDone, onClose }: { order: Order; methods: PaymentMethod[]; onDone: (o: Order) => void; onClose: () => void }) {
  const me = useMe();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [refund, setRefund] = useState(order.payments[0]?.methodId ?? methods[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const items = order.items
    .map((i) => ({ i, left: i.qtyMilli - i.returnedQtyMilli, q: qty[i.id] ? parseQty(qty[i.id]!) : 0 }))
    .filter((x) => x.left > 0);
  const picked = items.filter((x) => x.q && x.q > 0);
  const invalid = items.some((x) => x.q === null || (x.q ?? 0) > x.left);
  const branch = me.branches.find((b) => b.id === order.branch.id);

  return (
    <Modal title={`Return items · ${order.invoiceNumber}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="m-0 text-sm text-muted">Returned items go back into stock. A GST credit note is issued for the refund.</p>
        <div className="flex flex-col gap-2">
          {items.map(({ i, left, q }) => (
            <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{i.name}</span>
                <span className="text-xs text-muted">
                  Sold {formatQty(i.qtyMilli)} {i.unit} for {formatMoney(i.total)} · can return {formatQty(left)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setQty({ ...qty, [i.id]: formatQty(left) })}>
                  All
                </Button>
                <input
                  aria-label={`Return quantity of ${i.name}`}
                  inputMode="decimal"
                  placeholder="0"
                  value={qty[i.id] ?? ""}
                  onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                  className={`h-11 w-20 rounded-[10px] border text-center ${q === null || (q ?? 0) > left ? "border-[#A3361F]" : "border-line-strong"}`}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Refund by" value={refund} onChange={(e) => setRefund(e.target.value)}>
            {methods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.kind === "CREDIT" ? "Reduce udhaar (customer credit)" : m.name}
              </option>
            ))}
          </SelectField>
          <Field label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Damaged, wrong size…" />
        </div>
        <Button
          busy={busy}
          disabled={!picked.length || invalid || !reason.trim() || !branch?.withinPlan}
          onClick={async () => {
            setBusy(true);
            setError(null);
            try {
              const counter = await ensureCounter(order.branch.id);
              const { order: updated } = await apiPost<{ order: Order }>(`/orders/${order.id}/returns`, {
                counterId: counter.id,
                items: picked.map((x) => ({ orderItemId: x.i.id, qtyMilli: x.q })),
                refundMethodId: refund,
                reason,
              });
              onDone(updated);
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          Return and issue credit note
        </Button>
      </div>
    </Modal>
  );
}

function OrderDetail({ id, settings, methods, onChanged, onClose }: { id: string; settings: Settings; methods: PaymentMethod[]; onChanged: () => void; onClose: () => void }) {
  const me = useMe();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "cancel" | "return">(null);
  const [printCn, setPrintCn] = useState<string | undefined>(undefined);
  const [reason, setReason] = useState("");
  const canManage = me.user.role !== "CASHIER";

  useEffect(() => {
    apiGet<{ order: Order }>(`/orders/${id}`).then((r) => setOrder(r.order), (err: unknown) => setError(errorMessage(err)));
  }, [id]);

  const updated = (o: Order) => {
    setOrder(o);
    setDialog(null);
    onChanged();
  };

  return (
    <Modal title={order ? `Bill ${order.invoiceNumber}` : "Bill"} onClose={onClose} wide>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {order ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge(order)}
            {order.status === "CANCELLED" ? <span className="text-sm text-muted">Reason: {order.cancelReason}</span> : null}
          </div>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-line bg-cream p-3">
            <Receipt order={order} settings={settings} creditNoteId={printCn} />
          </div>
          {order.creditNotes.length ? (
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-sm font-semibold">Credit notes</h3>
              {order.creditNotes.map((c) => (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2 text-sm">
                  <span className="font-semibold">{c.number}</span>
                  <span className="text-muted">
                    {formatMoney(c.total)} · {c.refundMethodName} · {c.reason}
                  </span>
                  <Button variant="ghost" className="ml-auto" onClick={() => setPrintCn(printCn === c.id ? undefined : c.id)}>
                    {printCn === c.id ? "Show bill" : "Show credit note"}
                  </Button>
                </div>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => window.print()}>Print {printCn ? "credit note" : "bill"}</Button>
            {canManage && order.status === "COMPLETED" && order.returnedTotal < order.total ? (
              <Button variant="secondary" onClick={() => setDialog("return")}>
                Return items
              </Button>
            ) : null}
            {canManage && order.status === "COMPLETED" && order.returnedTotal === 0 ? (
              <Button variant="danger" onClick={() => setDialog("cancel")}>
                Cancel bill
              </Button>
            ) : null}
          </div>
          {dialog === "return" ? <ReturnDialog order={order} methods={methods} onDone={updated} onClose={() => setDialog(null)} /> : null}
          {dialog === "cancel" ? (
            <Modal title={`Cancel ${order.invoiceNumber}?`} onClose={() => setDialog(null)}>
              <div className="flex flex-col gap-4">
                <p className="m-0 text-sm">All {order.items.length} items go back into stock. The bill stays in your records marked cancelled.</p>
                <Field label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
                <Button
                  variant="danger"
                  disabled={!reason.trim()}
                  onClick={async () => {
                    try {
                      updated((await apiPost<{ order: Order }>(`/orders/${order.id}/cancel`, { reason })).order);
                    } catch (err) {
                      setError(errorMessage(err));
                      setDialog(null);
                    }
                  }}
                >
                  Cancel bill
                </Button>
              </div>
            </Modal>
          ) : null}
        </div>
      ) : (
        <p className="text-muted">Loading…</p>
      )}
    </Modal>
  );
}

export function OrdersPage() {
  const me = useMe();
  const isCashier = me.user.role === "CASHIER";
  const [branchId, setBranchId] = useState<string>(() => (isCashier ? (currentBranch(me)?.id ?? "") : ""));
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const branchCode = new Map(me.branches.map((b) => [b.id, b.code]));

  const load = useCallback(
    (before?: string) => {
      const params = new URLSearchParams({ limit: "50" });
      if (branchId) params.set("branchId", branchId);
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (before) params.set("before", before);
      apiGet<{ orders: OrderSummary[] }>(`/orders?${params}`).then(
        (r) => {
          setOrders((prev) => (before ? [...(prev ?? []), ...r.orders] : r.orders));
          setMore(r.orders.length === 50);
        },
        (err: unknown) => setError(errorMessage(err)),
      );
    },
    [branchId, q, status],
  );
  useEffect(() => {
    const t = window.setTimeout(() => load(), 250);
    return () => window.clearTimeout(t);
  }, [load]);
  useEffect(() => {
    Promise.all([apiGet<Settings>("/settings"), apiGet<{ methods: PaymentMethod[] }>("/payment-methods")]).then(([s, m]) => {
      setSettings(s);
      setMethods(m.methods.filter((x) => x.active));
    }, () => {});
  }, []);

  const totals = (orders ?? []).filter((o) => o.status === "COMPLETED").reduce((s, o) => s + o.total - o.returnedTotal, 0);

  return (
    <div className="w-full">
      <PageHeader title={isCashier ? "My sales today" : "Orders"} description={isCashier ? `Your bills since the start of today · ${formatMoney(totals)} net` : "Every bill, with returns and cancellations"} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card className="mb-4 flex flex-wrap items-end gap-3">
        <Field label="Search" placeholder="Bill no., customer name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="min-w-[220px] flex-[2_1_260px]" />
        {!isCashier && me.branches.length > 1 ? (
          <div className="flex-[1_1_180px]">
            <SelectField label="Branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              <option value="">All branches</option>
              {me.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        <div className="flex-[1_1_160px]">
          <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="COMPLETED">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </SelectField>
        </div>
      </Card>
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Bill</th>
              <th className="px-3 py-3 font-medium">When</th>
              <th className="px-3 py-3 font-medium">Customer</th>
              <th className="px-3 py-3 font-medium">Paid by</th>
              <th className="px-3 py-3 text-right font-medium">Total</th>
              <th className="px-3 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <button type="button" onClick={() => setOpen(o.id)} className="min-h-9 font-semibold text-indigo underline">
                    {o.invoiceNumber}
                  </button>
                  {me.branches.length > 1 ? <span className="ml-2 text-xs text-muted">{branchCode.get(o.branchId)}</span> : null}
                </td>
                <td className="px-3 py-3 text-muted">{new Date(o.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: me.account.timezone })}</td>
                <td className="px-3 py-3">{o.customerName || "Walk-in"}</td>
                <td className="px-3 py-3">{o.paymentMethods.join(", ")}</td>
                <td className="px-3 py-3 text-right font-semibold">
                  {formatMoney(o.total)}
                  {o.returnedTotal > 0 ? <span className="block text-xs font-normal text-muted">−{formatMoney(o.returnedTotal)} returned</span> : null}
                </td>
                <td className="px-3 py-3">{statusBadge(o)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders?.length === 0 ? <p className="m-0 px-4 py-6 text-center text-muted">No bills match.</p> : null}
      </div>
      {more ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => load(orders?.at(-1)?.createdAt)}>
            Load older bills
          </Button>
        </div>
      ) : null}
      {open && settings ? <OrderDetail id={open} settings={settings} methods={methods} onChanged={() => load()} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
