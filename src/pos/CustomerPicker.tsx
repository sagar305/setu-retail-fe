import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, Modal } from "../components/ui";
import { ApiError, apiGet, apiPost, type Customer } from "../lib/api";
import { errorMessage } from "../lib/format";

/** Search saved customers or add one, from the counter. */
export function CustomerPicker({ onPick, onClose }: { onPick: (c: Customer) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", gstin: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      apiGet<{ customers: Customer[] }>(`/customers?q=${encodeURIComponent(q)}&limit=20`, ctl.signal).then((r) => setRows(r.customers), () => {});
    }, 200);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const { customer } = await apiPost<{ customer: Customer }>("/customers", { name: form.name, phone: form.phone, gstin: form.gstin });
      onPick(customer);
    } catch (err) {
      if (err instanceof ApiError && err.code === "invalid_phone") setErrors({ phone: err.message });
      else if (err instanceof ApiError && err.code === "invalid_gstin") setErrors({ gstin: err.message });
      else if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={adding ? "New customer" : "Pick customer"} onClose={onClose}>
      {adding ? (
        <form onSubmit={add} className="flex flex-col gap-4" noValidate>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Field label="Mobile" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
          <Field label="GSTIN (for business customers)" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} error={errors.gstin} hint="Their state sets CGST/SGST or IGST." />
          <div className="flex gap-3">
            <Button type="submit" busy={busy} disabled={!form.name.trim()}>
              Save and use
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Back
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <Field label="Search name, mobile or GSTIN" value={q} onChange={(e) => setQ(e.target.value)} />
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {rows.map((c) => (
              <li key={c.id}>
                <button type="button" onClick={() => onPick(c)} className="flex min-h-12 w-full flex-col items-start rounded-xl border border-line px-3 py-2 text-left hover:border-indigo">
                  <span className="font-semibold">{c.name}</span>
                  <span className="text-xs text-muted">{[c.phone, c.gstin].filter(Boolean).join(" · ") || "No phone"}</span>
                </button>
              </li>
            ))}
          </ul>
          {rows.length === 0 ? <p className="m-0 text-sm text-muted">No matching customers.</p> : null}
          <Button variant="secondary" onClick={() => setAdding(true)}>
            Add new customer
          </Button>
        </div>
      )}
    </Modal>
  );
}
