import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useMe } from "../../auth/AuthProvider";
import { BranchSelect } from "../../components/BranchSelect";
import { useBranchChoice } from "../../hooks/useBranchChoice";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Button, Field, Modal, PageHeader, SelectField } from "../../components/ui";
import { apiDelete, apiGet, apiPatch, apiPost, type Expense, type PaymentMethod, type Supplier } from "../../lib/api";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage, formatDate } from "../../lib/format";
import { formatMoney, paiseToInput, parseMoney } from "../../lib/money";
import { PRESETS, presetDays, type Preset } from "../../lib/ranges";
import { useMoneyMethods } from "../../hooks/useMoneyMethods";

type List = { from: string; to: string; total: number; byCategory: { category: string; amount: number }[]; expenses: Expense[] };

/** A datetime-local value for an ISO instant, in the browser's time. */
const localInput = (iso: string) => {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

function ExpenseForm({ expense, branchId, methods, categories, onDone, onClose }: { expense: Expense | null; branchId: string; methods: PaymentMethod[]; categories: string[]; onDone: () => void; onClose: () => void }) {
  const [category, setCategory] = useState(expense?.category ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [amount, setAmount] = useState(paiseToInput(expense?.amount));
  const [methodId, setMethodId] = useState(expense?.methodId ?? methods.find((m) => m.kind === "CASH")?.id ?? methods[0]?.id ?? "");
  const [when, setWhen] = useState(localInput(expense?.spentAt ?? new Date().toISOString()));
  const [supplierId, setSupplierId] = useState(expense?.supplierId ?? "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paise = parseMoney(amount);

  useEffect(() => {
    apiGet<{ suppliers: Supplier[] }>("/suppliers").then((r) => setSuppliers(r.suppliers), () => {});
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!paise || !category.trim()) return;
    setBusy(true);
    setError(null);
    const body = { category: category.trim(), description, amount: paise, methodId, spentAt: new Date(when).toISOString(), supplierId: supplierId || null };
    try {
      if (expense) await apiPatch(`/expenses/${expense.id}`, body);
      else await apiPost("/expenses", { id: crypto.randomUUID(), branchId, ...body });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={expense ? "Edit expense" : "New expense"} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Category" list="expense-categories" autoFocus value={category} onChange={(e) => setCategory(e.target.value)} hint="Pick one or type your own." />
        <datalist id="expense-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <Field label="What for (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Field label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div role="group" aria-label="Paid by" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {methods.map((m) => (
            <button key={m.id} type="button" aria-pressed={m.id === methodId} onClick={() => setMethodId(m.id)} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${m.id === methodId ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
              {m.name}
            </button>
          ))}
        </div>
        <Field label="When" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        {suppliers.length ? (
          <SelectField label="Supplier (optional)" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">—</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </SelectField>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!paise || !category.trim() || !methodId}>
            {expense ? "Save" : `Add expense ${paise ? formatMoney(paise) : ""}`}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Expense Tracker: what the shop spends, by category. */
export function ExpensesPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const [branch, setBranch] = useBranchChoice();
  const methods = useMoneyMethods();
  const [preset, setPreset] = useState<Exclude<Preset, "custom">>("month");
  const [data, setData] = useState<List | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { expense: Expense | null }>(null);
  const range = useMemo(() => presetDays(preset, new Date(), tz), [preset, tz]);

  const load = useCallback(() => {
    if (!branch) return;
    apiGet<List>(`/expenses?branchId=${branch.id}&from=${range.first}&to=${range.last}`).then(setData, (e: unknown) => setError(errorMessage(e)));
    apiGet<{ categories: string[] }>("/expense-categories").then((r) => setCategories(r.categories), () => {});
  }, [branch, range]);
  useEffect(load, [load]);

  async function remove(x: Expense) {
    if (!window.confirm(`Delete ${x.category} ${formatMoney(x.amount)}?`)) return;
    try {
      await apiDelete(`/expenses/${x.id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  return (
    <div className="w-full">
      <PageHeader
        title="Expense Tracker"
        description="Cash expenses also show in the Cash Book. Everything here feeds the Profit Dashboard."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <BranchSelect value={branch.id} onChange={setBranch} />
            <Button variant="secondary" disabled={!data?.expenses.length} onClick={() => downloadCsv(`Expenses_${range.first}_${range.last}.csv`, toCsv(["Date", "Category", "Description", "Amount", "Paid by", "Supplier", "Entered by"], (data?.expenses ?? []).map((x) => [formatDate(x.spentAt, tz), x.category, x.description, (x.amount / 100).toFixed(2), x.methodName, x.supplierName ?? "", x.userName])))}>
              Export CSV
            </Button>
            <Button onClick={() => setDialog({ expense: null })} disabled={!methods.length}>
              Add expense
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div role="group" aria-label="Period" className="mb-4 flex flex-wrap gap-2">
        {PRESETS.filter((p) => p.id !== "custom").map((p) => (
          <button key={p.id} type="button" aria-pressed={preset === p.id} onClick={() => setPreset(p.id as typeof preset)} className={`min-h-10 rounded-full px-3.5 text-[13px] ${preset === p.id ? "bg-indigo font-medium text-white" : "border border-line bg-white text-ink"}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="Spent" value={formatMoney(data?.total ?? 0)} />
        {(data?.byCategory ?? []).slice(0, 3).map((c) => (
          <Stat key={c.category} label={c.category} value={formatMoney(c.amount)} />
        ))}
      </div>
      <DataTable
        minW={720}
        left={3}
        head={["When", "Category", "Paid by", "Amount", <span key="a" className="sr-only">Actions</span>]}
        empty={data ? "No expenses in this period." : "Loading…"}
        rows={(data?.expenses ?? []).map((x) => ({
          key: x.id,
          cells: [
            formatDate(x.spentAt, tz),
            <span key="c" className="flex flex-col">
              <strong>{x.category}</strong>
              <span className="text-xs text-muted">{[x.description, x.supplierName, x.offline ? "entered offline" : ""].filter(Boolean).join(" · ")}</span>
            </span>,
            x.methodName,
            formatMoney(x.amount),
            <span key="a" className="flex justify-end gap-1">
              <Button variant="secondary" onClick={() => setDialog({ expense: x })}>
                Edit
              </Button>
              <Button variant="ghost" aria-label={`Delete ${x.category} expense`} onClick={() => void remove(x)}>
                Delete
              </Button>
            </span>,
          ],
        }))}
      />
      {dialog ? (
        <ExpenseForm
          expense={dialog.expense}
          branchId={branch.id}
          methods={methods}
          categories={categories}
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

