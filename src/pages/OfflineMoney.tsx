import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSessionInfo } from "../auth/sessionInfo";
import { Alert, Badge, Button, Card, Field, PageHeader, SelectField } from "../components/ui";
import type { OfflinePack, SyncMoneyOp } from "../lib/api";
import { formatDate } from "../lib/format";
import { formatMoney, parseMoney } from "../lib/money";
import { readPref } from "../lib/storage";
import { toolOn } from "../lib/tools";
import { savedCounterId } from "../offline/counter";
import { db, type OutboxMoney } from "../offline/db";
import { queueMoney } from "../offline/outbox";
import { storedPack } from "../offline/pack";
import { useSync } from "../offline/SyncProvider";

type Kind = SyncMoneyOp["kind"];
const KIND_LABEL: Record<Kind, string> = { customer_payment: "Payment received", expense: "Expense", supplier_payment: "Paid supplier" };

/**
 * Payments received, expenses and payments to suppliers, saved on this
 * counter and synced when the internet is back. Works from the counter's
 * offline pack, so it needs Billing to have been opened online once.
 */
export function OfflineMoneyPage() {
  const s = useSessionInfo();
  const sync = useSync();
  const isOM = s.user.role !== "CASHIER";
  const branch = useMemo(() => s.branches.find((b) => b.id === readPref("setu-retail:branch")) ?? s.branches[0], [s.branches]);
  const [pack, setPack] = useState<OfflinePack | null | undefined>(undefined);
  const [queued, setQueued] = useState<OutboxMoney[]>([]);
  const [queuedCustomers, setQueuedCustomers] = useState<{ id: string; name: string; phone: string }[]>([]);
  const [kind, setKind] = useState<Kind>("customer_payment");
  const [partyId, setPartyId] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [methodId, setMethodId] = useState("");
  const [note, setNote] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const counterId = branch ? savedCounterId(branch.id) : null;

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    if (!branch) return;
    let alive = true;
    Promise.all([storedPack(branch.id), db.money.orderBy("createdAt").reverse().toArray(), db.customers.toArray()]).then(([p, money, custs]) => {
      if (!alive) return;
      setPack(p ?? null);
      setQueued(money);
      setQueuedCustomers(custs.map((c) => ({ id: c.id, name: c.payload.name, phone: c.payload.phone ?? "" })));
    });
    return () => {
      alive = false;
    };
  }, [branch, version, sync.pending]);

  const tools = pack?.settings.tools;
  const kinds = (["customer_payment", "expense", "supplier_payment"] as Kind[]).filter((k) => (k === "customer_payment" ? toolOn(tools, "customer-ledger") : isOM && toolOn(tools, k === "expense" ? "expense-tracker" : "supplier-ledger")));
  const activeKind = kinds.includes(kind) ? kind : kinds[0];
  const methods = (pack?.methods ?? []).filter((m) => m.kind !== "CREDIT");
  const method = methodId || methods.find((m) => m.kind === "CASH")?.id || methods[0]?.id || "";

  // Balances as of the pack, less what's been paid on this counter since.
  const paidHere = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of queued) {
      if (q.status !== "pending") continue;
      const p = q.payload;
      const id = p.kind === "customer_payment" ? p.customerId : p.kind === "supplier_payment" ? p.supplierId : null;
      if (id) m.set(id, (m.get(id) ?? 0) + p.amount);
    }
    return m;
  }, [queued]);
  const customers = useMemo(() => {
    const bal = new Map((pack?.customerBalances ?? []).map((b) => [b.customerId, b.balance]));
    return [...queuedCustomers, ...(pack?.customers ?? [])].map((c) => ({ id: c.id, name: c.name, phone: c.phone, balance: (bal.get(c.id) ?? 0) - (paidHere.get(c.id) ?? 0) })).sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
  }, [pack, queuedCustomers, paidHere]);
  const suppliers = useMemo(() => (pack?.suppliers ?? []).map((x) => ({ ...x, balance: x.balance - (paidHere.get(x.id) ?? 0) })), [pack, paidHere]);
  const party = activeKind === "customer_payment" ? customers.find((c) => c.id === partyId) : activeKind === "supplier_payment" ? suppliers.find((x) => x.id === partyId) : undefined;
  const paise = parseMoney(amount);
  const canSave = Boolean(paise && method && counterId && branch && (activeKind === "expense" ? category.trim() : party));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSave || !branch || !counterId || !paise || !activeKind) return;
    setBusy(true);
    const id = crypto.randomUUID();
    const at = new Date().toISOString();
    const base = { id, userId: s.user.id, at, amount: paise, methodId: method };
    const payload: SyncMoneyOp =
      activeKind === "expense"
        ? { kind: "expense", ...base, category: category.trim(), description: note.trim() || undefined }
        : activeKind === "customer_payment"
          ? { kind: "customer_payment", ...base, customerId: partyId, note: note.trim() || undefined }
          : { kind: "supplier_payment", ...base, supplierId: partyId, note: note.trim() || undefined };
    const label = activeKind === "expense" ? `${category.trim()}${note.trim() ? `: ${note.trim()}` : ""}` : `${activeKind === "customer_payment" ? "From" : "To"} ${party!.name}`;
    await queueMoney({ id, counterId, branchId: branch.id, createdAt: at, payload, label });
    setNotice(`${KIND_LABEL[activeKind]} of ${formatMoney(paise)} saved on this counter. It syncs when the internet is back.`);
    setAmount("");
    setNote("");
    setPartyId("");
    setBusy(false);
    sync.kick();
    reload();
  }

  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  if (pack === undefined) return <p className="text-muted">Loading…</p>;
  if (pack === null || !counterId) return <Alert tone="warn">This counter can't record payments offline yet: open Billing once while online.</Alert>;
  if (!kinds.length || !activeKind) return <Alert tone="info">No offline tools are switched on for you.</Alert>;

  return (
    <div className="flex w-full flex-col gap-5">
      <PageHeader title="Payments & expenses" description={`${pack.branch.name} (${pack.branch.code}). Saved on this counter, synced when the internet is back. Balances are as of ${formatDate(pack.at, pack.account.timezone)}.`} />
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex-[1_1_360px]">
          <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
            <div role="group" aria-label="What happened" className="grid grid-cols-3 gap-2">
              {kinds.map((k) => (
                <button key={k} type="button" aria-pressed={activeKind === k} onClick={() => { setKind(k); setPartyId(""); }} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${activeKind === k ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
            {activeKind === "customer_payment" ? (
              <SelectField label="Customer" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">Pick a customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.phone ? ` · ${c.phone}` : ""}
                    {c.balance > 0 ? ` · owes ${formatMoney(c.balance)}` : ""}
                  </option>
                ))}
              </SelectField>
            ) : activeKind === "supplier_payment" ? (
              <SelectField label="Supplier" value={partyId} onChange={(e) => setPartyId(e.target.value)}>
                <option value="">Pick a supplier</option>
                {suppliers.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name}
                    {x.balance > 0 ? ` · owed ${formatMoney(x.balance)}` : ""}
                  </option>
                ))}
              </SelectField>
            ) : (
              <>
                <Field label="Category" list="offline-expense-categories" value={category} onChange={(e) => setCategory(e.target.value)} />
                <datalist id="offline-expense-categories">
                  {pack.expenseCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
            {party && party.balance > 0 ? (
              <button type="button" onClick={() => setAmount(String(party.balance / 100))} className="self-start text-sm text-indigo underline">
                Fill the full {formatMoney(party.balance)}
              </button>
            ) : null}
            <Field label="Amount (₹)" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div role="group" aria-label="Paid by" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {methods.map((m) => (
                <button key={m.id} type="button" aria-pressed={m.id === method} onClick={() => setMethodId(m.id)} className={`min-h-11 rounded-[10px] px-2 text-[13px] ${m.id === method ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
                  {m.name}
                </button>
              ))}
            </div>
            <Field label={activeKind === "expense" ? "What for (optional)" : "Note (optional)"} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="submit" busy={busy} disabled={!canSave} className="h-[52px] text-base">
              Save {paise ? formatMoney(paise) : ""}
            </Button>
          </form>
        </Card>
        <section aria-label="On this counter" className="flex flex-[1_1_320px] flex-col gap-2">
          <h2 className="m-0 text-base font-semibold">On this counter</h2>
          {!queued.length ? <p className="m-0 text-sm text-muted">Nothing waiting to sync.</p> : null}
          {queued.map((q) => (
            <Card key={q.id}>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>{KIND_LABEL[q.payload.kind]}</strong>
                <span className="min-w-0 flex-1 text-muted">{q.label}</span>
                <span className="font-semibold">{formatMoney(q.payload.amount)}</span>
                <Badge tone={q.status === "rejected" ? "error" : "warn"}>{q.status === "rejected" ? "Needs attention" : "Waiting to sync"}</Badge>
              </div>
              {q.message ? <p className="m-0 mt-1 text-[13px] text-[#A3361F]">{q.message}</p> : null}
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}

