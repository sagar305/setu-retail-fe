import { useState } from "react";
import { EXPIRY_TONE, expiryLabel, useBatches } from "../lib/batches";
import { Alert, Badge, Button, Field, Modal } from "../components/ui";
import { apiPost, type Product } from "../lib/api";
import { errorMessage } from "../lib/format";
import { formatMoney, formatQty, parseMoney, parseQty } from "../lib/money";

/** Owner/manager: see a product's batches in this branch and receive a new one. */
export function BatchesDialog({ product, branchId, onChanged, onClose }: { product: Product; branchId: string; onChanged: () => void; onClose: () => void }) {
  const { batches, reload } = useBatches(product.id, branchId);
  const [form, setForm] = useState({ batchNo: "", expiry: "", qty: "", cost: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const qty = parseQty(form.qty);
  const cost = form.cost ? parseMoney(form.cost) : null;

  return (
    <Modal title={`Batches: ${product.name}`} onClose={onClose} wide>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          {batches === null ? <p className="m-0 text-muted">Loading…</p> : null}
          {batches?.length === 0 ? <p className="m-0 text-muted">No stock in batches here.</p> : null}
          {batches?.map((b, i) => (
            <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line px-3 py-2">
              <span className="font-semibold">{b.opening ? "Opening stock" : b.batchNo || "No batch no."}</span>
              <Badge tone={EXPIRY_TONE[b.status]}>{expiryLabel(b)}</Badge>
              {i === 0 ? <Badge tone="info">Sells first</Badge> : null}
              <span className="ml-auto text-sm">
                {formatQty(b.qtyMilli)} {product.unit}
                {b.costPrice !== null ? <span className="text-muted"> · cost {formatMoney(b.costPrice)}</span> : null}
              </span>
            </div>
          ))}
        </div>
        <form
          className="flex flex-col gap-4 rounded-xl bg-paper p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError(null);
            try {
              await apiPost(`/products/${product.id}/batches`, { branchId, batchNo: form.batchNo, expiry: form.expiry || null, qtyMilli: qty, costPrice: cost });
              setForm({ batchNo: "", expiry: "", qty: "", cost: "" });
              reload();
              onChanged();
            } catch (err) {
              setError(errorMessage(err));
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3 className="m-0 text-sm font-semibold">Receive a batch</h3>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="grid gap-3 md:grid-cols-4">
            <Field label="Batch no." value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
            <Field label="Expiry" type="date" value={form.expiry} onChange={(e) => setForm({ ...form, expiry: e.target.value })} />
            <Field label={`Quantity (${product.unit})`} inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} error={form.qty && qty === null ? "Enter a quantity." : undefined} />
            <Field label="Cost per unit (₹)" inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} error={form.cost && cost === null ? "Enter an amount." : undefined} />
          </div>
          <Button type="submit" busy={busy} disabled={!qty || (Boolean(form.cost) && cost === null)} className="self-start">
            Add batch to stock
          </Button>
        </form>
      </div>
    </Modal>
  );
}

/** Cashier: pick which batch a bill line comes from (default: earliest expiry). */
export function BatchPicker({ product, branchId, current, onPick, onClose }: { product: Product; branchId: string; current: string | null; onPick: (id: string | null) => void; onClose: () => void }) {
  const { batches } = useBatches(product.id, branchId);
  return (
    <Modal title={`Batch for ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-2">
        <button type="button" onClick={() => onPick(null)} className={`min-h-12 rounded-xl px-3 text-left ${current === null ? "border-2 border-indigo" : "border border-line"}`}>
          <strong>Earliest expiry first</strong> <span className="text-sm text-muted">(automatic)</span>
        </button>
        {batches?.map((b) => (
          <button key={b.id} type="button" onClick={() => onPick(b.id)} className={`flex min-h-12 flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-left ${current === b.id ? "border-2 border-indigo" : "border border-line"}`}>
            <strong>{b.opening ? "Opening stock" : b.batchNo || "No batch no."}</strong>
            <Badge tone={EXPIRY_TONE[b.status]}>{expiryLabel(b)}</Badge>
            <span className="ml-auto text-sm text-muted">
              {formatQty(b.qtyMilli)} {product.unit} left
            </span>
          </button>
        ))}
        {batches?.some((b) => b.status === "expired") ? <Alert tone="warn">Expired batches can still be sold, but check before you do.</Alert> : null}
      </div>
    </Modal>
  );
}
