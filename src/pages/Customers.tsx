import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "../auth/AuthProvider";
import { Alert, Button, Field, Modal, PageHeader } from "../components/ui";
import { ApiError, apiGet, apiPatch, apiPost, type Customer } from "../lib/api";
import { errorMessage, formatDate } from "../lib/format";

type Draft = { name: string; phone: string; email: string; gstin: string; stateCode: string; address: string; notes: string };
const blank: Draft = { name: "", phone: "", email: "", gstin: "", stateCode: "", address: "", notes: "" };

function CustomerForm({ customer, onDone, onClose }: { customer: Customer | null; onDone: () => void; onClose: () => void }) {
  const [d, setD] = useState<Draft>(customer ? { name: customer.name, phone: customer.phone, email: customer.email, gstin: customer.gstin ?? "", stateCode: customer.stateCode ?? "", address: customer.address, notes: customer.notes } : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      if (customer) await apiPatch(`/customers/${customer.id}`, d);
      else await apiPost("/customers", d);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === "invalid_phone") setErrors({ phone: err.message });
      else if (err instanceof ApiError && err.code === "invalid_gstin") setErrors({ gstin: err.message });
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={customer ? `Edit ${customer.name}` : "New customer"} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" required value={d.name} onChange={set("name")} error={errors.name} />
          <Field label="Mobile" type="tel" value={d.phone} onChange={set("phone")} error={errors.phone} />
          <Field label="Email" type="email" value={d.email} onChange={set("email")} error={errors.email} />
          <Field label="GSTIN" value={d.gstin} onChange={set("gstin")} error={errors.gstin} hint="For business customers. Sets their state." />
          <Field label="GST state code" inputMode="numeric" maxLength={2} value={d.stateCode} onChange={set("stateCode")} error={errors.stateCode} hint="e.g. 27 for Maharashtra; decides CGST/SGST vs IGST." />
          <Field label="Address" value={d.address} onChange={set("address")} />
          <Field label="Notes" value={d.notes} onChange={set("notes")} className="md:col-span-2" />
        </div>
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!d.name.trim()}>
            {customer ? "Save" : "Add customer"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CustomersPage() {
  const me = useMe();
  const canEdit = me.user.role !== "CASHIER";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { customer: Customer | null }>(null);
  const limit = me.plan.current?.limits.maxCustomers ?? null;

  const load = useCallback(() => {
    apiGet<{ customers: Customer[]; total: number }>(`/customers?q=${encodeURIComponent(q)}&limit=200`).then(
      (r) => {
        setRows(r.customers);
        if (!q) setTotal(r.total);
      },
      (err: unknown) => setError(errorMessage(err)),
    );
  }, [q]);
  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="w-full">
      <PageHeader
        title="Customers"
        description={`${total.toLocaleString("en-IN")}${limit === null ? "" : ` of ${limit.toLocaleString("en-IN")}`} customers`}
        actions={<Button onClick={() => setDialog({ customer: null })}>Add customer</Button>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <label htmlFor="c-search" className="sr-only">
        Search customers
      </label>
      <input id="c-search" type="search" placeholder="Search name, mobile or GSTIN" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Mobile</th>
              <th className="px-3 py-3 font-medium">GSTIN · state</th>
              <th className="px-3 py-3 font-medium">Added</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((c) => (
              <tr key={c.id} className="border-t border-line">
                <td className="px-4 py-3 font-semibold">{c.name}</td>
                <td className="px-3 py-3">{c.phone || "—"}</td>
                <td className="px-3 py-3 text-muted">{[c.gstin, c.stateCode].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-3 py-3 text-muted">{formatDate(c.createdAt, me.account.timezone)}</td>
                <td className="px-3 py-3 text-right">
                  {canEdit ? (
                    <Button variant="secondary" onClick={() => setDialog({ customer: c })}>
                      Edit
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows?.length === 0 ? <p className="m-0 px-4 py-6 text-center text-muted">No customers yet.</p> : null}
      </div>
      {dialog ? (
        <CustomerForm
          customer={dialog.customer}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      ) : null}
    </div>
  );
}
