import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { DataTable } from "../components/DataTable";
import { Alert, Badge, Button, Field, Modal, PageHeader, SelectField } from "../components/ui";
import { useSettings } from "../hooks/useSettings";
import { apiGet, apiPost, type Product, type Transfer } from "../lib/api";
import { currentBranch } from "../lib/branch";
import { errorMessage, formatDate } from "../lib/format";
import { formatMoney, formatQty, parseQty } from "../lib/money";

const STATUS: Record<Transfer["status"], { label: string; tone: "warn" | "ok" | "muted" }> = { SENT: { label: "In transit", tone: "warn" }, RECEIVED: { label: "Received", tone: "ok" }, CANCELLED: { label: "Cancelled", tone: "muted" } };

function useBranchName() {
  const me = useMe();
  return (id: string) => {
    const b = me.branches.find((x) => x.id === id);
    return b ? `${b.name} (${b.code})` : "Another branch";
  };
}

function NewTransfer({ onDone, onClose }: { onDone: (t: Transfer) => void; onClose: () => void }) {
  const me = useMe();
  const settings = useSettings();
  const usable = me.branches.filter((b) => b.withinPlan);
  const [from, setFrom] = useState(currentBranch(me)?.id ?? usable[0]?.id ?? "");
  const [to, setTo] = useState(usable.find((b) => b.id !== from)?.id ?? "");
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<{ key: string; productId: string; qty: string }[]>([{ key: crypto.randomUUID(), productId: "", qty: "" }]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useMemo(() => crypto.randomUUID(), []);

  useEffect(() => {
    if (from) apiGet<{ products: Product[] }>(`/products?branchId=${from}&limit=2000`).then((r) => setProducts(r.products.filter((p) => p.trackStock)), () => {});
  }, [from]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const parsed = lines.map((l) => ({ ...l, milli: parseQty(l.qty), product: byId.get(l.productId) }));
  const ready = parsed.filter((l) => l.product && l.milli && l.milli > 0);
  const over = ready.filter((l) => l.milli! > l.product!.stockMilli);
  const value = ready.reduce((s, l) => s + (l.product!.costPrice ? Math.round((l.product!.costPrice * l.milli!) / 1000) : 0), 0);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await apiPost<{ transfer: Transfer }>("/transfers", { id, fromBranchId: from, toBranchId: to, note, lines: ready.map((l) => ({ productId: l.productId, qtyMilli: l.milli! })) });
      onDone(r.transfer);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title="Send stock to another branch" onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="From" value={from} onChange={(e) => { setFrom(e.target.value); if (e.target.value === to) setTo(usable.find((b) => b.id !== e.target.value)?.id ?? ""); }}>
            {usable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </SelectField>
          <SelectField label="To" value={to} onChange={(e) => setTo(e.target.value)}>
            {usable.filter((b) => b.id !== from).map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-col gap-2">
          {lines.map((l, i) => {
            const p = byId.get(l.productId);
            return (
              <div key={l.key} className="flex flex-wrap items-end gap-3 border-b border-cream pb-2">
                <div className="min-w-[220px] flex-1">
                  <SelectField label={`Product ${i + 1}`} value={l.productId} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, productId: e.target.value } : x)))}>
                    <option value="">Pick a product</option>
                    {products.map((x) => (
                      <option key={x.id} value={x.id} disabled={x.stockMilli <= 0}>
                        {x.name} · {formatQty(Math.max(0, x.stockMilli))} {x.unit} in stock
                      </option>
                    ))}
                  </SelectField>
                </div>
                <Field label={`Qty${p ? ` (${p.unit})` : ""}`} inputMode="decimal" value={l.qty} onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, qty: e.target.value } : x)))} className="w-28" error={p && (parseQty(l.qty) ?? 0) > p.stockMilli ? `Only ${formatQty(p.stockMilli)}` : undefined} />
                {lines.length > 1 ? (
                  <Button variant="ghost" aria-label={`Remove product ${i + 1}`} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                    Remove
                  </Button>
                ) : null}
              </div>
            );
          })}
          <Button variant="secondary" className="self-start" onClick={() => setLines((ls) => [...ls, { key: crypto.randomUUID(), productId: "", qty: "" }])}>
            Add product
          </Button>
        </div>
        {settings?.batchTracking ? <p className="m-0 text-sm text-muted">Batches go earliest expiry first; the other branch gets the same batch numbers, expiry and cost.</p> : null}
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Weekly top-up" />
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" busy={busy} disabled={!ready.length || over.length > 0 || !to || ready.length !== lines.filter((l) => l.productId || l.qty).length}>
            Send {ready.length} product{ready.length === 1 ? "" : "s"}
          </Button>
          {value ? <span className="text-sm text-muted">Value at cost {formatMoney(value)}</span> : null}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function TransferDetail({ t, onChange, onClose }: { t: Transfer; onChange: (t: Transfer) => void; onClose: () => void }) {
  const me = useMe();
  const tz = me.account.timezone;
  const name = useBranchName();
  const [got, setGot] = useState<Record<string, string>>(() => Object.fromEntries(t.items.map((i) => [i.id, formatQty(i.qtyMilli)])));
  const [short, setShort] = useState<Record<string, "RETURN" | "WRITE_OFF">>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canReceive = t.status === "SENT" && me.branches.some((b) => b.id === t.toBranchId && b.withinPlan);
  const canCancel = t.status === "SENT" && me.branches.some((b) => b.id === t.fromBranchId && b.withinPlan);
  const rows = t.items.map((i) => {
    const r = parseQty(got[i.id] ?? "");
    return { i, received: r, missing: r === null ? 0 : i.qtyMilli - r };
  });
  const invalid = rows.some((r) => r.received === null || r.received < 0 || r.received > r.i.qtyMilli);

  async function receive() {
    setBusy(true);
    setError(null);
    try {
      const lines = rows.map((r) => ({ itemId: r.i.id, receivedMilli: r.received!, ...(r.missing > 0 ? { short: short[r.i.id] ?? "RETURN" } : {}) }));
      onChange((await apiPost<{ transfer: Transfer }>(`/transfers/${t.id}/receive`, { note, lines })).transfer);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!window.confirm(`Cancel ${t.number}? The stock goes back to ${name(t.fromBranchId)}.`)) return;
    try {
      onChange((await apiPost<{ transfer: Transfer }>(`/transfers/${t.id}/cancel`, {})).transfer);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Modal title={`${t.number} · ${STATUS[t.status].label}`} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        {error ? <Alert tone="error">{error}</Alert> : null}
        <p className="m-0 text-sm">
          <strong>{name(t.fromBranchId)}</strong> → <strong>{name(t.toBranchId)}</strong> · sent {formatDate(t.sentAt, tz)} by {t.sentByName}
          {t.receivedAt ? ` · received ${formatDate(t.receivedAt, tz)} by ${t.receivedByName}` : ""}
          {t.note ? ` · “${t.note}”` : ""}
          {t.receiveNote ? ` · on arrival: “${t.receiveNote}”` : ""}
        </p>
        <div className="flex flex-col gap-2">
          {rows.map(({ i, missing }) => (
            <div key={i.id} className="flex flex-wrap items-end gap-3 border-b border-cream pb-2">
              <span className="min-w-[200px] flex-1 text-sm">
                <strong>{i.name}</strong>
                <span className="block text-xs text-muted">
                  Sent {formatQty(i.qtyMilli)} {i.unit}
                  {i.batches.some((b) => b.batchNo || b.expiry) ? ` · ${i.batches.filter((b) => b.batchNo || b.expiry).map((b) => `${b.batchNo || "—"}${b.expiry ? ` exp ${b.expiry}` : ""} × ${formatQty(b.qtyMilli)}`).join(", ")}` : ""}
                </span>
                {i.receivedMilli !== null ? (
                  <span className="block text-xs">
                    Received {formatQty(i.receivedMilli)}
                    {i.returnedMilli ? ` · ${formatQty(i.returnedMilli)} back to sender` : ""}
                    {i.writtenOffMilli ? ` · ${formatQty(i.writtenOffMilli)} written off` : ""}
                  </span>
                ) : null}
              </span>
              {canReceive ? (
                <>
                  <Field label="Arrived OK" inputMode="decimal" value={got[i.id] ?? ""} onChange={(e) => setGot({ ...got, [i.id]: e.target.value })} className="w-28" error={(parseQty(got[i.id] ?? "") ?? 0) > i.qtyMilli ? "More than was sent" : parseQty(got[i.id] ?? "") === null ? "Enter a number" : undefined} />
                  {missing > 0 ? (
                    <SelectField label={`${formatQty(missing)} short / damaged`} value={short[i.id] ?? "RETURN"} onChange={(e) => setShort({ ...short, [i.id]: e.target.value as "RETURN" })}>
                      <option value="RETURN">Back to sender</option>
                      <option value="WRITE_OFF">Write off</option>
                    </SelectField>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
        {canReceive ? <Field label="Note on arrival (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 packs torn" /> : null}
        <div className="flex flex-wrap gap-3">
          {canReceive ? (
            <Button busy={busy} disabled={invalid} onClick={() => void receive()}>
              Receive · stock in
            </Button>
          ) : null}
          {canCancel ? (
            <Button variant="danger" onClick={() => void cancel()}>
              Cancel transfer
            </Button>
          ) : null}
          {t.status === "SENT" && !canReceive ? <span className="self-center text-sm text-muted">Waiting for {name(t.toBranchId)} to receive it.</span> : null}
        </div>
      </div>
    </Modal>
  );
}

/** Stock transfers between branches. */
export function TransfersPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const name = useBranchName();
  const [tab, setTab] = useState<"SENT" | "">("SENT");
  const [rows, setRows] = useState<Transfer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState<Transfer | null>(null);
  const load = useCallback(() => {
    apiGet<{ transfers: Transfer[] }>(`/transfers${tab ? `?status=${tab}` : ""}`).then((r) => setRows(r.transfers), (e: unknown) => setError(errorMessage(e)));
  }, [tab]);
  useEffect(load, [load]);

  if (me.branches.filter((b) => b.withinPlan).length < 2) {
    return (
      <div className="w-full">
        <PageHeader title="Stock transfers" />
        <Alert tone="info">Transfers move stock between your branches. {me.user.role === "OWNER" ? <Link to="/branches">Add a second branch</Link> : "You work in one branch."} to use them.</Alert>
      </div>
    );
  }
  const incoming = (rows ?? []).filter((t) => t.status === "SENT" && me.branches.some((b) => b.id === t.toBranchId));
  return (
    <div className="w-full">
      <PageHeader
        title="Stock transfers"
        description="Send stock to another branch; it's in transit until that branch checks and receives it."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/branch-reports" className="flex min-h-11 items-center px-2 text-sm font-semibold text-indigo">
              Branch reports
            </Link>
            <Button onClick={() => setCreating(true)}>Send stock</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {tab === "SENT" && incoming.length ? <Alert tone="warn">{incoming.length} transfer{incoming.length === 1 ? " is" : "s are"} on the way to your branch: open to check and receive.</Alert> : null}
      <div role="group" aria-label="Show" className="mb-3 flex gap-2">
        {(
          [
            ["SENT", "In transit"],
            ["", "All"],
          ] as const
        ).map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => setTab(k)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${tab === k ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}>
            {label}
          </button>
        ))}
      </div>
      <DataTable
        minW={720}
        left={3}
        head={["Transfer", "From → To", "Sent", "Products", "Value", "Status"]}
        empty={rows ? (tab ? "Nothing in transit." : "No transfers yet.") : "Loading…"}
        rows={(rows ?? []).map((t) => ({
          key: t.id,
          cells: [
            <button key="n" type="button" onClick={() => setOpen(t)} className="min-h-9 font-semibold text-indigo hover:underline">
              {t.number}
            </button>,
            `${name(t.fromBranchId)} → ${name(t.toBranchId)}`,
            formatDate(t.sentAt, tz),
            t.items.length,
            formatMoney(t.value),
            <span key="s" className="flex justify-end gap-1">
              <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
              {t.shortMilli ? <Badge tone="error">Short</Badge> : null}
            </span>,
          ],
        }))}
      />
      {creating ? (
        <NewTransfer
          onClose={() => setCreating(false)}
          onDone={(t) => {
            setCreating(false);
            setNotice(`${t.number} sent. Stock is in transit until ${name(t.toBranchId)} receives it.`);
            load();
          }}
        />
      ) : null}
      {open ? (
        <TransferDetail
          t={open}
          onClose={() => setOpen(null)}
          onChange={(t) => {
            setOpen(null);
            setNotice(t.status === "RECEIVED" ? `${t.number} received.` : `${t.number} cancelled; the stock is back.`);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
