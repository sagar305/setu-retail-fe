import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useLocalList } from "../hooks/useLocalList";
import { filterCustomers } from "../lib/listData";
import { useTaxWords } from "../hooks/useSettings";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { useMe } from "../auth/AuthProvider";
import { Alert, Button, Field, Modal, PageHeader } from "../components/ui";
import { ApiError, apiGet, type Customer } from "../lib/api";
import { Pagination } from "../components/Pagination";
import { usePageSize } from "../hooks/usePageSize";
import { newUuid, saveChange } from "../lib/changes";
import { errorMessage, formatDate } from "../lib/format";
import { downloadCsv, toCsv } from "../lib/csv";

type Draft = { name: string; phone: string; email: string; gstin: string; stateCode: string; address: string; notes: string; creditDays: string };
const blank: Draft = { name: "", phone: "", email: "", gstin: "", stateCode: "", address: "", notes: "", creditDays: "" };

function CustomerForm({ customer, onDone, onClose }: { customer: Customer | null; onDone: () => void; onClose: () => void }) {
  const words = useTaxWords();
  const [d, setD] = useState<Draft>(customer ? { name: customer.name, phone: customer.phone, email: customer.email, gstin: customer.gstin ?? "", stateCode: customer.stateCode ?? "", address: customer.address, notes: customer.notes, creditDays: customer.creditDays === null ? "" : String(customer.creditDays) } : blank);
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
      const body = { ...d, creditDays: d.creditDays === "" ? null : Number(d.creditDays) };
      // Checked here too, because the cloud only sees it later.
      if (body.phone && body.phone.replace(/\D/g, "").length < 10) {
        setErrors({ phone: "Enter a 10-digit mobile number." });
        return setBusy(false);
      }
      if (customer) {
        const before: Record<string, unknown> = { name: customer.name, phone: customer.phone, email: customer.email, gstin: customer.gstin ?? "", stateCode: customer.stateCode ?? "", address: customer.address, notes: customer.notes, creditDays: customer.creditDays };
        const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null)));
        if (Object.keys(changed).length) {
          const base = Object.fromEntries(Object.keys(changed).map((k) => [k, k === "gstin" || k === "stateCode" ? ((customer as Record<string, unknown>)[k] ?? null) : before[k]]));
          await saveChange({ method: "PATCH", path: `/customers/${customer.id}`, body: changed, base, label: `${customer.name}: details changed`, effects: [{ kind: "update", id: customer.id, fields: changed }] });
        }
      } else {
        const id = newUuid();
        await saveChange({ method: "POST", path: "/customers", body: { ...body, id }, label: `New customer ${body.name}`, effects: [{ kind: "insert", into: "/customers?", key: "customers", item: { ...body, id, gstin: body.gstin || null, stateCode: body.stateCode || null, balance: 0, archived: false, createdAt: new Date().toISOString() } }] });
      }
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
          <Field label={words.number} value={d.gstin} onChange={set("gstin")} error={errors.gstin} hint={words.custom ? "For business customers." : "For business customers. Sets their state."} />
          {words.custom ? null : <Field label="GST state code" inputMode="numeric" maxLength={2} value={d.stateCode} onChange={set("stateCode")} error={errors.stateCode} hint="e.g. 27 for Maharashtra; decides CGST/SGST vs IGST." />}
          <Field label="Address" value={d.address} onChange={set("address")} />
          <Field label="Credit days (optional)" inputMode="numeric" value={d.creditDays} onChange={(e) => setD({ ...d, creditDays: e.target.value.replace(/\D/g, "").slice(0, 3) })} error={errors.creditDays} hint="When their udhaar is due. Leave blank to use the shop's setting." />
          <Field label="Notes" value={d.notes} onChange={set("notes")} />
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
  const words = useTaxWords();
  const me = useMe();
  const canEdit = me.user.role !== "CASHIER";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Customer[] | null>(null);
  const [total, setTotal] = useState(0);
  const [matching, setMatching] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize("customers");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { customer: Customer | null }>(null);
  const limit = me.plan.current?.limits.maxCustomers ?? null;

  // A new search or page size starts again from the first page.
  const filters = `${q.trim()}|${pageSize}`;
  const lastFilters = useRef(filters);
  useEffect(() => {
    if (lastFilters.current !== filters) {
      lastFilters.current = filters;
      setPage(0);
    }
  }, [filters]);

  // The whole list on this device (loaded after sign-in): search and pages work
  // here with no API call. Until then, the API page by page.
  const local = useLocalList("customers", "");
  const isLocal = Boolean(local);
  const found = useMemo(() => (local ? filterCustomers(local.rows, q) : null), [local, q]);

  const load = useCallback(() => {
    if (isLocal) return;
    apiGet<{ customers: Customer[]; total: number }>(`/customers?q=${encodeURIComponent(q.trim())}&limit=${pageSize}&offset=${page * pageSize}`).then(
      (r) => {
        setError(null);
        setRows(r.customers);
        setMatching(r.total);
        if (!q.trim()) setTotal(r.total);
      },
      (err: unknown) => setError(errorMessage(err)),
    );
  }, [q, page, pageSize, isLocal]);

  /** Every customer that matches the search, not just this page. */
  async function exportCsv() {
    setExporting(true);
    try {
      const all: Customer[] = found ? [...found] : [];
      for (let offset = 0; !found; offset += 500) {
        const r = await apiGet<{ customers: Customer[]; total: number }>(`/customers?q=${encodeURIComponent(q.trim())}&limit=500&offset=${offset}`);
        all.push(...r.customers);
        if (all.length >= r.total || r.customers.length === 0) break;
      }
      downloadCsv("Customers.csv", toCsv(["Name", "Phone", "Email", words.number, "State Code", "Address", "Notes"], all.map((c) => [c.name, c.phone, c.email, c.gstin ?? "", c.stateCode ?? "", c.address, c.notes])));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }
  useCacheRefresh(["/customers?"], load);
  const shownRows = found ? found.slice(page * pageSize, (page + 1) * pageSize) : rows;
  const shownMatching = found ? found.length : matching;
  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  return (
    <div className="w-full">
      <PageHeader
        title="Customers"
        description={`${(local ? local.rows.length : total).toLocaleString("en-IN")}${limit === null ? "" : ` of ${limit.toLocaleString("en-IN")}`} customers`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit ? (
              <Button variant="secondary" disabled={!shownMatching} busy={exporting} onClick={() => void exportCsv()}>
                Export CSV
              </Button>
            ) : null}
            <Button onClick={() => setDialog({ customer: null })}>Add customer</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <label htmlFor="c-search" className="sr-only">
        Search customers
      </label>
      <input id="c-search" type="search" placeholder={`Search name, mobile or ${words.number}`} value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Mobile</th>
              <th className="px-3 py-3 font-medium">{words.custom ? words.number : `${words.number} · state`}</th>
              <th className="px-3 py-3 font-medium">Added</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(shownRows ?? []).map((c) => (
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
        {shownRows?.length === 0 ? <p className="m-0 px-4 py-6 text-center text-muted">{q.trim() ? "No customers match." : "No customers yet."}</p> : null}
      </div>
      <Pagination page={page} pageSize={pageSize} total={shownMatching} onPage={setPage} onPageSize={setPageSize} noun="customers" />
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
