import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { DataTable, Stat } from "../../components/DataTable";
import { Alert, Button, PageHeader } from "../../components/ui";
import { CustomerPicker } from "../../pos/CustomerPicker";
import { apiGet, apiPost, type Customer, type Statement } from "../../lib/api";
import { currentBranch } from "../../lib/branch";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage } from "../../lib/format";
import { formatMoney } from "../../lib/money";
import { OpeningDialog, PaymentDialog, StatementView } from "./ledgerParts";
import { useMoneyMethods } from "../../hooks/useMoneyMethods";

type Row = { customer: Customer; balance: number };

/** Customer Ledger: who owes udhaar, and how much. */
export function CustomerLedgerPage() {
  const [data, setData] = useState<{ owed: number; advance: number; customers: Row[] } | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    apiGet<{ owed: number; advance: number; customers: Row[] }>("/ledger/customers").then(setData, (e: unknown) => setError(errorMessage(e)));
  }, []);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.customers ?? []).filter((r) => !t || r.customer.name.toLowerCase().includes(t) || r.customer.phone.includes(t));
  }, [data, q]);

  return (
    <div className="w-full">
      <PageHeader
        title="Customer Ledger"
        description="Udhaar from credit bills and payments received, per customer."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={!rows.length} onClick={() => downloadCsv("Customer_Ledger.csv", toCsv(["Customer", "Mobile", "Balance"], rows.map((r) => [r.customer.name, r.customer.phone, (r.balance / 100).toFixed(2)])))}>
              Export CSV
            </Button>
            <Button onClick={() => setPicking(true)}>Find a customer</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label="Customers owe you" value={formatMoney(data?.owed ?? 0)} tone={data?.owed ? "warn" : undefined} />
        <Stat label="Paid in advance" value={formatMoney(data?.advance ?? 0)} />
        <Stat label="Customers with a balance" value={data?.customers.length ?? 0} />
      </div>
      <label htmlFor="cl-q" className="sr-only">
        Search
      </label>
      <input id="cl-q" type="search" placeholder="Search name or mobile" value={q} onChange={(e) => setQ(e.target.value)} className="mb-3 h-11 w-full max-w-xl rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
      <DataTable
        minW={420}
        head={["Customer", "Mobile", "Balance"]}
        left={2}
        empty={data ? "Nobody owes you anything." : "Loading…"}
        rows={rows.map((r) => ({
          key: r.customer.id,
          cells: [
            <Link key="n" to={`/tools/customer-ledger/${r.customer.id}`} className="font-semibold">
              {r.customer.name}
            </Link>,
            r.customer.phone || "—",
            <span key="b" className={r.balance > 0 ? "font-semibold text-[#A3361F]" : "text-ok"}>
              {r.balance > 0 ? formatMoney(r.balance) : `Advance ${formatMoney(-r.balance)}`}
            </span>,
          ],
        }))}
      />
      {picking ? (
        <CustomerPicker
          onClose={() => setPicking(false)}
          onPick={(c) => {
            setPicking(false);
            navigate(`/tools/customer-ledger/${c.id}`);
          }}
        />
      ) : null}
    </div>
  );
}

/** One customer's udhaar statement, with "Receive payment". */
export function CustomerStatementPage() {
  const { id = "" } = useParams();
  const me = useMe();
  const isOM = me.user.role !== "CASHIER";
  const methods = useMoneyMethods();
  const [data, setData] = useState<(Statement & { customer: Customer }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | "pay" | "opening">(null);

  const load = useCallback(() => {
    apiGet<Statement & { customer: Customer }>(`/customers/${id}/ledger`).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  async function undo(entryId: string) {
    if (!window.confirm("Undo this entry? The amount goes back on the customer's balance.")) return;
    try {
      await apiPost(`/ledger/customer-entries/${entryId}/void`, { reason: "Undone from the ledger" });
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const branches = me.branches.filter((b) => b.withinPlan);
  return (
    <div className="w-full">
      <PageHeader
        title={data ? data.customer.name : "Customer Ledger"}
        description={data ? [data.customer.phone, data.customer.gstin].filter(Boolean).join(" · ") || "Udhaar statement" : undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/tools/customer-ledger" className="flex min-h-11 items-center px-2 text-sm font-semibold text-indigo">
              All customers
            </Link>
            {isOM ? (
              <Button variant="secondary" onClick={() => setDialog("opening")}>
                Opening balance
              </Button>
            ) : null}
            <Button onClick={() => setDialog("pay")} disabled={!methods.length}>
              Receive payment
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {data ? <StatementView st={data} owedLabel="Owes you" onVoid={isOM ? undo : undefined} /> : <p className="text-muted">Loading…</p>}
      {dialog === "pay" && data ? (
        <PaymentDialog
          title={`Payment from ${data.customer.name}`}
          owed={data.balance}
          methods={methods}
          branches={branches}
          defaultBranchId={currentBranch(me)?.id ?? branches[0]?.id ?? ""}
          submitLabel="Receive"
          onClose={() => setDialog(null)}
          onSubmit={async (p) => {
            const r = await apiPost<Statement & { customer: Customer }>(`/customers/${id}/payments`, { id: crypto.randomUUID(), ...p });
            setData(r);
            setDialog(null);
            setNotice(`Received ${formatMoney(p.amount)}. ${r.balance > 0 ? `Still owes ${formatMoney(r.balance)}.` : "All clear."}`);
          }}
        />
      ) : null}
      {dialog === "opening" ? (
        <OpeningDialog
          title="Opening balance"
          onClose={() => setDialog(null)}
          onSubmit={async (p) => {
            setData(await apiPost<Statement & { customer: Customer }>(`/customers/${id}/opening`, { id: crypto.randomUUID(), amount: p.amount, date: p.date, note: p.note }));
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}
