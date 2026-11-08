import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useTaxWords } from "../hooks/useSettings";
import { Alert, Button, Field, Modal } from "../components/ui";
import { ApiError, apiGet, apiPost, type Customer } from "../lib/api";
import { errorMessage } from "../lib/format";

/** Search saved customers or add one, from the counter. */
/** `local`: no internet — search the counter's saved customers and add new ones to the sync queue. */
export function CustomerPicker({ onPick, onClose, local }: { onPick: (c: Customer) => void; onClose: () => void; local?: { customers: Customer[]; add: (c: { name: string; phone: string; gstin: string }) => Promise<Customer> } }) {
  const words = useTaxWords();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Customer[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", gstin: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const localCustomers = local?.customers;
  const rows = useMemo(() => {
    if (!localCustomers) return remote;
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    return localCustomers.filter((c) => !t || c.name.toLowerCase().includes(t) || (digits.length >= 3 && c.phone.includes(digits)) || c.gstin === q.trim().toUpperCase()).slice(0, 20);
  }, [localCustomers, remote, q]);

  const isLocal = Boolean(local);
  useEffect(() => {
    if (isLocal) return;
    const ctl = new AbortController();
    const t = window.setTimeout(() => {
      apiGet<{ customers: Customer[] }>(`/customers?q=${encodeURIComponent(q)}&limit=20`, ctl.signal).then((r) => setRemote(r.customers), () => {});
    }, 200);
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [q, isLocal]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      if (local) return onPick(await local.add(form));
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
          <Field label={`${words.number} (for business customers)`} value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} error={errors.gstin} hint={words.custom ? undefined : "Their state sets CGST/SGST or IGST."} />
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
          <Field label={`Search name, mobile or ${words.number}`} value={q} onChange={(e) => setQ(e.target.value)} />
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
