import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "../../auth/AuthProvider";
import { BranchSelect } from "../../components/BranchSelect";
import { useBranchChoice } from "../../hooks/useBranchChoice";
import { Stat } from "../../components/DataTable";
import { Alert, Badge, Button, Card, Field, Modal, PageHeader } from "../../components/ui";
import { apiDelete, apiGet, apiPost, apiPut, type CashBook } from "../../lib/api";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage } from "../../lib/format";
import { formatMoney, parseMoney } from "../../lib/money";
import { shopDay } from "../../lib/ranges";

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const SOURCE: Record<string, string> = { sale: "Sales", refund: "Refund", customer_payment: "Udhaar received", expense: "Expense", supplier_payment: "Paid supplier", purchase: "Supplier bill", manual: "Manual" };

function EntryForm({ branchId, onDone, onClose }: { branchId: string; onDone: () => void; onClose: () => void }) {
  const [type, setType] = useState<"IN" | "OUT">("OUT");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const paise = parseMoney(amount);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!paise || !description.trim()) return;
    setBusy(true);
    try {
      await apiPost("/cash-book/entries", { id: crypto.randomUUID(), branchId, type, amount: paise, description: description.trim() });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <Modal title="Cash in or out" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-sm text-muted">For cash that isn't a sale, expense or payment, e.g. the owner adding change or taking cash to the bank.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div role="group" aria-label="Direction" className="grid grid-cols-2 gap-2">
          {(["IN", "OUT"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-11 rounded-[10px] text-sm ${type === t ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line bg-white"}`}>
              {t === "IN" ? "Cash in" : "Cash out"}
            </button>
          ))}
        </div>
        <Field label="Amount (₹)" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Field label="What for" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Deposited at bank" />
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!paise || !description.trim()}>
            Add
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function OpeningForm({ branchId, current, today, onDone, onClose }: { branchId: string; current: CashBook["opening"]; today: string; onDone: () => void; onClose: () => void }) {
  const [day, setDay] = useState(current?.day ?? today);
  const [amount, setAmount] = useState(current ? String(current.amount / 100) : "");
  const [error, setError] = useState<string | null>(null);
  const paise = parseMoney(amount);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (paise === null) return;
    try {
      await apiPut("/cash-book/opening", { branchId, day, amount: paise });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <Modal title="Opening cash" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-sm text-muted">Count the cash in the drawer once. From that day on, each day opens with the previous day's closing.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Counted on" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
        <Field label="Cash in the drawer that morning (₹)" inputMode="decimal" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} />
        <div className="flex gap-3">
          <Button type="submit" disabled={paise === null}>
            Save opening cash
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

/** Cash Book: a branch's cash in and out, day by day. */
export function CashBookPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const today = shopDay(new Date(), tz);
  const [branch, setBranch] = useBranchChoice();
  const [to, setTo] = useState(today);
  const [data, setData] = useState<CashBook | null>(null);
  const [open, setOpen] = useState<string>(today);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "entry" | "opening">(null);
  const from = addDays(to, -6);

  const load = useCallback(() => {
    if (!branch) return;
    apiGet<CashBook>(`/cash-book?branchId=${branch.id}&from=${from}&to=${to}`).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [branch, from, to]);
  useEffect(load, [load]);

  async function remove(id: string) {
    if (!window.confirm("Delete this cash line?")) return;
    try {
      await apiDelete(`/cash-book/entries/${id}`);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!branch) return <Alert tone="warn">No branch is active for you.</Alert>;
  const days = [...(data?.days ?? [])].reverse();
  const last = data?.days[data.days.length - 1];
  return (
    <div className="w-full">
      <PageHeader
        title="Cash Book"
        description={`${branch.name} (${branch.code}). Cash sales, refunds, payments and expenses post here on their own.`}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <BranchSelect value={branch.id} onChange={setBranch} />
            <Button
              variant="secondary"
              disabled={!data}
              onClick={() => downloadCsv(`Cash_Book_${branch.code}_${from}_${to}.csv`, toCsv(["Day", "Time", "In/Out", "What", "Type", "Amount", "Closing"], (data?.days ?? []).flatMap((d) => [...d.lines.map((l) => [d.day, new Date(l.at).toLocaleTimeString("en-IN", { timeZone: tz }), l.direction, l.label, SOURCE[l.source] ?? l.source, (l.amount / 100).toFixed(2), ""]), [d.day, "", "", "Closing", "", "", (d.closing / 100).toFixed(2)]])))}
            >
              Export CSV
            </Button>
            {me.user.role === "OWNER" ? (
              <Button variant="secondary" onClick={() => setDialog("opening")}>
                Opening cash
              </Button>
            ) : null}
            <Button onClick={() => setDialog("entry")}>Cash in / out</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {data && !data.opening ? (
        <Alert tone="info">
          No opening cash yet{me.user.role === "OWNER" ? ": count the drawer once and set it, so closing balances match the drawer." : ". Ask the owner to set it."}
        </Alert>
      ) : null}
      <div className="my-4 flex flex-wrap items-end gap-3">
        <Stat label={`Closing ${to === today ? "now" : dayLabel(to)}`} value={formatMoney(last?.closing ?? 0)} tone={last && last.closing < 0 ? "warn" : undefined} />
        <Stat label="In (7 days)" value={formatMoney((data?.days ?? []).reduce((s, d) => s + d.in, 0))} tone="ok" />
        <Stat label="Out (7 days)" value={formatMoney((data?.days ?? []).reduce((s, d) => s + d.out, 0))} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" aria-label="Earlier week" onClick={() => setTo(addDays(to, -7))}>
            ‹ Earlier
          </Button>
          <Button variant="secondary" aria-label="Later week" disabled={to >= today} onClick={() => setTo(addDays(to, 7) > today ? today : addDays(to, 7))}>
            Later ›
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3">
        {days.map((d) => (
          <Card key={d.day}>
            <button type="button" aria-expanded={open === d.day} onClick={() => setOpen(open === d.day ? "" : d.day)} className="flex w-full flex-wrap items-center gap-x-5 gap-y-1 text-left">
              <span className="mr-auto font-semibold">
                {dayLabel(d.day)}
                {d.day === today ? " · today" : ""}
              </span>
              <span className="text-sm text-muted">Opening {formatMoney(d.opening)}</span>
              <span className="text-sm text-ok">In {formatMoney(d.in)}</span>
              <span className="text-sm">Out {formatMoney(d.out)}</span>
              <span className={`font-bold ${d.closing < 0 ? "text-[#A3361F]" : "text-indigo"}`}>Closing {formatMoney(d.closing)}</span>
            </button>
            {open === d.day ? (
              <ul className="m-0 mt-3 flex list-none flex-col border-t border-cream p-0">
                {d.lines.map((l) => (
                  <li key={l.id} className="flex flex-wrap items-center gap-3 border-b border-cream py-2.5 text-sm last:border-b-0">
                    <span className="w-20 shrink-0 whitespace-nowrap text-muted">{new Date(l.at).toLocaleTimeString("en-IN", { timeZone: tz, hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="min-w-0 flex-1">
                      {l.label} <Badge tone="muted">{SOURCE[l.source] ?? l.source}</Badge>
                    </span>
                    <span className={`font-semibold ${l.direction === "IN" ? "text-ok" : ""}`}>
                      {l.direction === "IN" ? "+" : "−"}
                      {formatMoney(l.amount)}
                    </span>
                    {l.deletable ? (
                      <Button variant="ghost" aria-label={`Delete ${l.label}`} onClick={() => void remove(l.id)}>
                        Delete
                      </Button>
                    ) : null}
                  </li>
                ))}
                {!d.lines.length ? <li className="py-3 text-sm text-muted">No cash moved this day.</li> : null}
              </ul>
            ) : null}
          </Card>
        ))}
      </div>
      {dialog === "entry" ? (
        <EntryForm
          branchId={branch.id}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            load();
          }}
        />
      ) : null}
      {dialog === "opening" ? (
        <OpeningForm
          branchId={branch.id}
          current={data?.opening ?? null}
          today={today}
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
