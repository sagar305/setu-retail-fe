import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Button, Field, Modal, PageHeader } from "../../components/ui";
import { useSettings } from "../../hooks/useSettings";
import { ApiError, apiDelete, apiGet, apiPatch, apiPost, type Statement, type Supplier } from "../../lib/api";
import { currentBranch } from "../../lib/branch";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage } from "../../lib/format";
import { formatMoney } from "../../lib/money";
import { toolOn } from "../../lib/tools";
import { OpeningDialog, PaymentDialog, StatementView } from "./ledgerParts";
import { useMoneyMethods } from "../../hooks/useMoneyMethods";

type Draft = { name: string; phone: string; email: string; gstin: string; stateCode: string; address: string; notes: string };

export function SupplierForm({ supplier, onDone, onClose }: { supplier: Supplier | null; onDone: (s: Supplier) => void; onClose: () => void }) {
  const [d, setD] = useState<Draft>({ name: supplier?.name ?? "", phone: supplier?.phone ?? "", email: supplier?.email ?? "", gstin: supplier?.gstin ?? "", stateCode: supplier?.stateCode ?? "", address: supplier?.address ?? "", notes: supplier?.notes ?? "" });
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
      const r = supplier ? await apiPatch<{ supplier: Supplier }>(`/suppliers/${supplier.id}`, d) : await apiPost<{ supplier: Supplier }>("/suppliers", d);
      onDone(r.supplier);
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === "invalid_phone") setErrors({ phone: err.message });
      else if (err instanceof ApiError && err.code === "invalid_gstin") setErrors({ gstin: err.message });
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={supplier ? `Edit ${supplier.name}` : "New supplier"} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" required autoFocus value={d.name} onChange={set("name")} error={errors.name} />
          <Field label="Phone" type="tel" value={d.phone} onChange={set("phone")} error={errors.phone} />
          <Field label="GSTIN" value={d.gstin} onChange={set("gstin")} error={errors.gstin} hint="Sets their state, which decides CGST/SGST or IGST on their bills." />
          <Field label="GST state code" inputMode="numeric" maxLength={2} value={d.stateCode} onChange={set("stateCode")} error={errors.stateCode} hint="If they have no GSTIN, e.g. 29 for Karnataka." />
          <Field label="Email" type="email" value={d.email} onChange={set("email")} error={errors.email} />
          <Field label="Address" value={d.address} onChange={set("address")} />
          <Field label="Notes" value={d.notes} onChange={set("notes")} className="md:col-span-2" />
        </div>
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!d.name.trim()}>
            {supplier ? "Save" : "Add supplier"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Supplier Book: contacts, GSTINs and what you owe each. */
export function SupplierBookPage() {
  const settings = useSettings();
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { supplier: Supplier | null }>(null);
  const ledgerOn = toolOn(settings?.tools, "supplier-ledger");

  const load = useCallback(() => {
    apiGet<{ suppliers: Supplier[] }>(`/suppliers?q=${encodeURIComponent(q)}`).then((r) => setRows(r.suppliers), (e: unknown) => setError(errorMessage(e)));
  }, [q]);
  useEffect(() => {
    const t = window.setTimeout(load, 200);
    return () => window.clearTimeout(t);
  }, [load]);

  async function remove(s: Supplier) {
    if (!window.confirm(`Remove ${s.name} from the Supplier Book? Their old bills stay.`)) return;
    try {
      await apiDelete(`/suppliers/${s.id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Supplier Book"
        description="Supplier contacts and GSTINs, shared with the Purchase Register and Supplier Ledger."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!rows?.length} onClick={() => downloadCsv("Suppliers.csv", toCsv(["Name", "Phone", "Email", "GSTIN", "State Code", "Address", "Notes", "Balance"], (rows ?? []).map((s) => [s.name, s.phone, s.email, s.gstin ?? "", s.stateCode ?? "", s.address, s.notes, (s.balance / 100).toFixed(2)])))}>
              Export CSV
            </Button>
            <Button onClick={() => setDialog({ supplier: null })}>Add supplier</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <label htmlFor="s-q" className="sr-only">
        Search suppliers
      </label>
      <input id="s-q" type="search" placeholder="Search name, phone or GSTIN" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <DataTable
        minW={640}
        left={3}
        head={["Supplier", "Phone", "GSTIN · state", "You owe", <span key="a" className="sr-only">Actions</span>]}
        empty={rows ? "No suppliers yet." : "Loading…"}
        rows={(rows ?? []).map((s) => ({
          key: s.id,
          cells: [
            ledgerOn ? (
              <Link key="n" to={`/tools/supplier-ledger/${s.id}`} className="font-semibold">
                {s.name}
              </Link>
            ) : (
              <strong key="n">{s.name}</strong>
            ),
            s.phone || "—",
            [s.gstin, s.stateCode].filter(Boolean).join(" · ") || "—",
            s.balance ? formatMoney(s.balance) : "—",
            <span key="a" className="flex justify-end gap-1">
              <Button variant="secondary" onClick={() => setDialog({ supplier: s })}>
                Edit
              </Button>
              <Button variant="ghost" aria-label={`Remove ${s.name}`} onClick={() => void remove(s)}>
                Remove
              </Button>
            </span>,
          ],
        }))}
      />
      {dialog ? (
        <SupplierForm
          supplier={dialog.supplier}
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

/** Supplier Ledger: who you owe. */
export function SupplierLedgerPage() {
  const [data, setData] = useState<{ owed: number; advance: number; suppliers: { supplier: Supplier; balance: number }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    apiGet<NonNullable<typeof data>>("/ledger/suppliers").then(setData, (e: unknown) => setError(errorMessage(e)));
  }, []);
  return (
    <div className="w-full">
      <PageHeader title="Supplier Ledger" description="What you owe each supplier: bills on credit, minus payments made and goods returned." actions={<Link to="/tools/suppliers" className="text-sm font-semibold text-indigo">All suppliers</Link>} />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="You owe suppliers" value={formatMoney(data?.owed ?? 0)} tone={data?.owed ? "warn" : undefined} />
        <Stat label="Advances with suppliers" value={formatMoney(data?.advance ?? 0)} />
      </div>
      <DataTable
        minW={420}
        left={2}
        head={["Supplier", "Phone", "Balance"]}
        empty={data ? "You don't owe any supplier." : "Loading…"}
        rows={(data?.suppliers ?? []).map((r) => ({
          key: r.supplier.id,
          cells: [
            <Link key="n" to={`/tools/supplier-ledger/${r.supplier.id}`} className="font-semibold">
              {r.supplier.name}
            </Link>,
            r.supplier.phone || "—",
            <span key="b" className={r.balance > 0 ? "font-semibold text-[#A3361F]" : "text-ok"}>
              {r.balance > 0 ? formatMoney(r.balance) : `Advance ${formatMoney(-r.balance)}`}
            </span>,
          ],
        }))}
      />
    </div>
  );
}

export function SupplierStatementPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const methods = useMoneyMethods();
  const [data, setData] = useState<(Statement & { supplier: Supplier }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "pay" | "opening">(null);
  const load = useCallback(() => {
    apiGet<Statement & { supplier: Supplier }>(`/suppliers/${id}/ledger`).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  async function undo(entryId: string) {
    if (!window.confirm("Undo this entry?")) return;
    try {
      await apiPost(`/ledger/supplier-entries/${entryId}/void`, { reason: "Undone from the ledger" });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const branches = me.branches.filter((b) => b.withinPlan);
  return (
    <div className="w-full">
      <PageHeader
        title={data ? data.supplier.name : "Supplier Ledger"}
        description={data ? [data.supplier.phone, data.supplier.gstin].filter(Boolean).join(" · ") || "Supplier statement" : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/tools/supplier-ledger" className="flex min-h-11 items-center px-2 text-sm font-semibold text-indigo">
              All suppliers
            </Link>
            <Button variant="secondary" onClick={() => setDialog("opening")}>
              Opening balance
            </Button>
            <Button onClick={() => setDialog("pay")} disabled={!methods.length}>
              Record payment
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {data ? <StatementView st={data} owedLabel="You owe" onVoid={undo} /> : <p className="text-muted">Loading…</p>}
      {dialog === "pay" && data ? (
        <PaymentDialog
          title={`Pay ${data.supplier.name}`}
          owed={data.balance}
          methods={methods}
          branches={branches}
          defaultBranchId={currentBranch(me)?.id ?? branches[0]?.id ?? ""}
          submitLabel="Record payment of"
          onClose={() => setDialog(null)}
          onSubmit={async (p) => {
            const r = await apiPost<Statement & { supplier: Supplier }>(`/suppliers/${id}/payments`, { id: crypto.randomUUID(), ...p });
            setData(r);
            setDialog(null);
            setNotice(`Paid ${formatMoney(p.amount)}. ${r.balance > 0 ? `Still owed: ${formatMoney(r.balance)}.` : "All settled."}`);
          }}
        />
      ) : null}
      {dialog === "opening" ? (
        <OpeningDialog
          title="Opening balance"
          withDue
          onClose={() => setDialog(null)}
          onSubmit={async (p) => {
            setData(await apiPost<Statement & { supplier: Supplier }>(`/suppliers/${id}/opening`, { id: crypto.randomUUID(), ...p }));
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
