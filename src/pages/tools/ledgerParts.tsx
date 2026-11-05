import { useState, type FormEvent } from "react";
import { useMe } from "../../auth/AuthProvider";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Badge, Button, Field, Modal, SelectField } from "../../components/ui";
import type { PaymentMethod, Statement } from "../../lib/api";
import { errorMessage, formatDate } from "../../lib/format";
import { formatMoney, parseMoney } from "../../lib/money";

const TYPE_LABEL: Record<string, string> = {
  bill: "Udhaar bill",
  opening: "Opening balance",
  credit: "Udhaar",
  payment: "Payment",
  credit_note: "Credit note",
  purchase: "Supplier bill",
  paid_on_bill: "Paid with bill",
  return: "Returned goods",
};

export function StatementView({ st, owedLabel, onVoid }: { st: Statement; owedLabel: string; onVoid?: (id: string) => void }) {
  const me = useMe();
  const tz = me.account.timezone;
  const when = (iso: string) => formatDate(iso, tz);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-3">
        <Stat label={st.balance >= 0 ? owedLabel : "Advance (paid ahead)"} value={formatMoney(Math.abs(st.balance))} tone={st.balance > 0 ? "warn" : "ok"} />
        <Stat label="Unpaid bills" value={st.openItems.length} />
        {st.openItems[0] ? <Stat label="Oldest unpaid since" value={when(st.openItems[0].at)} /> : null}
      </div>
      {st.openItems.length ? (
        <section className="flex flex-col gap-2">
          <h2 className="m-0 text-base font-semibold">Unpaid, oldest first</h2>
          <p className="m-0 text-[13px] text-muted">Payments clear the oldest dues first.</p>
          <DataTable
            minW={520}
            head={["Bill", "Date", "Due", "Amount", "Paid", "Still due"]}
            left={3}
            rows={st.openItems.map((i) => ({ key: i.id, cells: [i.ref || TYPE_LABEL[i.type] || i.type, when(i.at), i.dueDate ? formatDate(`${i.dueDate}T12:00:00Z`, tz) : "—", formatMoney(i.amount), formatMoney(i.paid), <strong key="o">{formatMoney(i.open)}</strong>] }))}
          />
        </section>
      ) : null}
      <section className="flex flex-col gap-2">
        <h2 className="m-0 text-base font-semibold">All entries</h2>
        <DataTable
          minW={640}
          left={2}
          head={["Date", "What", "Owed", "Paid", "Balance", <span key="a" className="sr-only">Actions</span>]}
          empty="No entries yet."
          rows={st.rows.map((r) => ({
            key: r.id,
            cells: [
              when(r.at),
              <span key="w" className="flex flex-col">
                <span>
                  {TYPE_LABEL[r.type] ?? r.type}
                  {r.ref ? ` · ${r.ref}` : ""}
                  {r.methodName ? <Badge tone="muted">{r.methodName}</Badge> : null}
                </span>
                {r.note ? <span className="text-xs text-muted">{r.note}</span> : null}
              </span>,
              r.debit ? formatMoney(r.debit) : "",
              r.credit ? formatMoney(r.credit) : "",
              formatMoney(r.balance),
              onVoid && r.voidable ? (
                <Button key="v" variant="ghost" onClick={() => onVoid(r.id)}>
                  Undo
                </Button>
              ) : (
                ""
              ),
            ],
          }))}
        />
      </section>
    </div>
  );
}

export function PaymentDialog({ title, owed, methods, branches, defaultBranchId, submitLabel, onSubmit, onClose }: { title: string; owed: number; methods: PaymentMethod[]; branches: { id: string; name: string; code: string }[]; defaultBranchId: string; submitLabel: string; onSubmit: (p: { amount: number; methodId: string; branchId: string; note: string }) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState(owed > 0 ? (owed / 100).toFixed(2).replace(/\.00$/, "") : "");
  const [methodId, setMethodId] = useState(methods.find((m) => m.kind === "CASH")?.id ?? methods[0]?.id ?? "");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paise = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!paise || !methodId) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ amount: paise, methodId, branchId, note });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Amount (₹)" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} hint={owed > 0 ? `Due now: ${formatMoney(owed)}` : undefined} />
        <div role="group" aria-label="Paid by" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methods.map((m) => (
            <button key={m.id} type="button" aria-pressed={m.id === methodId} onClick={() => setMethodId(m.id)} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${m.id === methodId ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
              {m.name}
            </button>
          ))}
        </div>
        {branches.length > 1 ? (
          <SelectField label="Branch (its cash book)" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </SelectField>
        ) : null}
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!paise || !methodId}>
            {submitLabel} {paise ? formatMoney(paise) : ""}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function OpeningDialog({ title, withDue, onSubmit, onClose }: { title: string; withDue?: boolean; onSubmit: (p: { amount: number; date: string; dueDate?: string; note: string }) => Promise<void>; onClose: () => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paise = parseMoney(amount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!paise || !date) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ amount: paise, date, dueDate: due || undefined, note });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-sm text-muted">Dues from before Setu Retail. They count as the oldest bill, so payments clear them first.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Amount (₹)" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="From date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        {withDue ? <Field label="Due by (optional)" type="date" value={due} onChange={(e) => setDue(e.target.value)} /> : null}
        <Field label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. From the old notebook" />
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!paise || !date}>
            Add opening balance
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}
