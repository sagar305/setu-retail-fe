import { Fragment, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMe } from "../../auth/AuthProvider";
import { Stat } from "../../components/DataTable";
import { Alert, Badge, Button, Field, Modal, PageHeader } from "../../components/ui";
import { setSettings, useSettings } from "../../hooks/useSettings";
import { apiGet, apiPatch, type CustomerAging, type Settings, type SupplierAging } from "../../lib/api";
import { downloadCsv, toCsv } from "../../lib/csv";
import { errorMessage, formatDate } from "../../lib/format";
import { formatMoney } from "../../lib/money";

type Kind = "customers" | "suppliers";
type Party = (CustomerAging["parties"][number] | SupplierAging["parties"][number]) & { creditDays?: number };
const KEYS = ["current", "d30", "d60", "d90", "d90plus"] as const;
const TONE: Record<(typeof KEYS)[number], string> = { current: "text-ok", d30: "text-ink", d60: "text-warn", d90: "text-[#A3361F]", d90plus: "text-[#A3361F] font-bold" };
const day = (d: string, tz: string) => formatDate(`${d}T12:00:00Z`, tz);

function CreditDaysDialog({ current, onClose }: { current: number; onClose: () => void }) {
  const [v, setV] = useState(String(current));
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      setSettings(await apiPatch<Settings>("/settings", { creditDays: Number(v) }));
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return (
    <Modal title="Credit days" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <p className="m-0 text-sm text-muted">Udhaar is due this many days after the bill. 0 = due the same day. You can give a customer their own credit days in Customers.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Days" inputMode="numeric" autoFocus value={v} onChange={(e) => setV(e.target.value.replace(/\D/g, ""))} />
        <Button type="submit" disabled={v === "" || Number(v) > 365} className="self-start">
          Save
        </Button>
      </form>
    </Modal>
  );
}

/** Invoice Aging (customers' udhaar) and Payables Aging (supplier bills). */
export function AgingPage({ kind }: { kind: Kind }) {
  const me = useMe();
  const tz = me.account.timezone;
  const settings = useSettings();
  const [data, setData] = useState<(CustomerAging | SupplierAging) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [editDays, setEditDays] = useState(false);
  const customers = kind === "customers";
  const creditDays = settings?.creditDays;

  useEffect(() => {
    apiGet<CustomerAging | SupplierAging>(`/reports/aging/${kind}`).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [kind, creditDays]);

  const parties = (data?.parties ?? []) as Party[];
  const idOf = (p: Party) => ("customerId" in p ? p.customerId : p.supplierId);
  const overdue = data ? data.total - data.totals.current : 0;
  const label = (k: string) => data?.buckets.find((b) => b.key === k)?.label ?? k;

  function csv() {
    downloadCsv(
      `${customers ? "Invoice" : "Payables"}_Aging_${data!.asOf}.csv`,
      toCsv(
        [customers ? "Customer" : "Supplier", "Phone", ...KEYS.map(label), "Total", "Most overdue (days)"],
        parties.map((p) => [p.name, p.phone, ...KEYS.map((k) => (p.buckets[k] / 100).toFixed(2)), (p.open / 100).toFixed(2), String(p.maxDaysOverdue)]),
      ),
    );
  }

  return (
    <div className="w-full">
      <PageHeader
        title={customers ? "Invoice Aging" : "Payables Aging"}
        description={customers ? `Udhaar by how overdue it is. Due ${creditDays ?? 0} day${creditDays === 1 ? "" : "s"} after the bill unless a customer has their own credit days.` : "Unpaid supplier bills by due date (the bill date when there's none)."}
        actions={
          <div className="flex flex-wrap gap-2">
            {customers && me.user.role === "OWNER" ? (
              <Button variant="secondary" onClick={() => setEditDays(true)}>
                Credit days: {creditDays ?? 0}
              </Button>
            ) : null}
            <Button variant="secondary" disabled={!parties.length} onClick={csv}>
              Export CSV
            </Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label={customers ? "Customers owe" : "You owe"} value={formatMoney(data?.total ?? 0)} />
        <Stat label="Overdue" value={formatMoney(overdue)} tone={overdue ? "warn" : "ok"} />
        <Stat label="90+ days" value={formatMoney(data?.totals.d90plus ?? 0)} tone={data?.totals.d90plus ? "warn" : undefined} />
      </div>
      {data && "dueThisWeek" in data && data.dueThisWeek.length ? (
        <Alert tone="info">
          Due in the next 7 days: {data.dueThisWeek.map((d) => `${d.name} ${d.ref} ${formatMoney(d.open)} on ${day(d.dueDay, tz)}`).join(" · ")}
        </Alert>
      ) : null}
      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-2.5 font-medium">{customers ? "Customer" : "Supplier"}</th>
              {KEYS.map((k) => (
                <th key={k} className="px-3 py-2.5 text-right font-medium">
                  {label(k)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-line bg-cream/40 font-semibold">
              <td className="px-4 py-2.5">All</td>
              {KEYS.map((k) => (
                <td key={k} className={`px-3 py-2.5 text-right ${data?.totals[k] ? TONE[k] : "text-muted"}`}>
                  {formatMoney(data?.totals[k] ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right">{formatMoney(data?.total ?? 0)}</td>
            </tr>
            {parties.map((p) => {
              const id = idOf(p);
              return (
                <Fragment key={id}>
                  <tr className="border-t border-line">
                    <td className="px-4 py-2.5">
                      <button type="button" aria-expanded={open === id} onClick={() => setOpen(open === id ? null : id)} className="min-h-9 text-left font-semibold text-indigo underline-offset-2 hover:underline">
                        {p.name}
                      </button>
                      <span className="block text-xs text-muted">
                        {[p.phone, p.maxDaysOverdue ? `${p.maxDaysOverdue} days overdue` : "not overdue", customers && p.creditDays !== creditDays ? `${p.creditDays} credit days` : ""].filter(Boolean).join(" · ")}
                      </span>
                    </td>
                    {KEYS.map((k) => (
                      <td key={k} className={`px-3 py-2.5 text-right ${p.buckets[k] ? TONE[k] : "text-muted"}`}>
                        {p.buckets[k] ? formatMoney(p.buckets[k]) : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold">{formatMoney(p.open)}</td>
                  </tr>
                  {open === id ? (
                    <tr className="bg-paper">
                      <td colSpan={7} className="px-4 py-3">
                        <ul className="m-0 flex list-none flex-col gap-1 p-0">
                          {p.items.map((i) => (
                            <li key={i.id} className="flex flex-wrap items-center gap-3">
                              <span className="w-40">{i.ref || (i.type === "opening" ? "Opening balance" : i.type)}</span>
                              <span className="text-muted">Billed {formatDate(i.at, tz)}</span>
                              <span className="text-muted">Due {day(i.dueDay, tz)}</span>
                              <Badge tone={i.bucket === "current" ? "ok" : i.daysOverdue > 60 ? "error" : "warn"}>{i.daysOverdue ? `${i.daysOverdue} days overdue` : "Not due"}</Badge>
                              <span className="ml-auto font-semibold">{formatMoney(i.open)}</span>
                            </li>
                          ))}
                        </ul>
                        <Link to={customers ? `/tools/customer-ledger/${id}` : `/tools/supplier-ledger/${id}`} className="mt-2 inline-block text-sm font-semibold">
                          Open ledger{customers ? " · receive payment" : " · record payment"}
                        </Link>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
        {data && !parties.length ? <p className="m-0 px-4 py-5 text-center text-muted">{customers ? "No udhaar outstanding." : "No unpaid supplier bills."}</p> : null}
      </div>
      {editDays ? <CreditDaysDialog current={creditDays ?? 0} onClose={() => setEditDays(false)} /> : null}
    </div>
  );
}
