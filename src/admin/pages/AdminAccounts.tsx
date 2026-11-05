import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Badge, Button, Field, PageHeader, SelectField } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { adminApi, type AccountRow } from "../api";
import { day, planLabel, STATUS_LABEL, STATUS_TONE } from "../text";

const PAGE = 50;

export function AdminAccountsPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get("status") ?? "";
  const expiring = Number(params.get("expiring") ?? 0) || 0;
  const q = params.get("q") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;
  const [search, setSearch] = useState(q);
  const [data, setData] = useState<{ accounts: AccountRow[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.accounts({ q, status, expiring, offset }).then(setData, (e: unknown) => setError(errorMessage(e)));
  }, [q, status, expiring, offset]);

  const update = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) if (v) next.set(k, v); else next.delete(k);
    if (!("offset" in patch)) next.delete("offset");
    setParams(next);
  };
  const view = expiring ? `expiring-${expiring}` : status;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Accounts" description="Plan, contact and usage only. Shops' bills and customers are never shown here." />
      <form
        className="grid gap-3 sm:grid-cols-[1fr_220px_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          update({ q: search.trim() });
        }}
      >
        <Field label="Search" type="search" placeholder="Shop name, owner, email or phone" value={search} onChange={(e) => setSearch(e.target.value)} />
        <SelectField
          label="Show"
          value={view}
          onChange={(e) => {
            const v = e.target.value;
            if (v.startsWith("expiring-")) update({ status: "", expiring: v.slice(9) });
            else update({ status: v, expiring: "" });
          }}
        >
          <option value="">All accounts</option>
          <option value="expiring-14">Ending in 14 days</option>
          <option value="expiring-30">Ending in 30 days</option>
          {Object.entries(STATUS_LABEL).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {data ? (
        <>
          <p className="m-0 text-sm text-muted">
            {data.total.toLocaleString("en-IN")} account{data.total === 1 ? "" : "s"}
          </p>
          <ul className="m-0 flex list-none flex-col overflow-hidden rounded-2xl border border-line bg-white p-0">
            {data.accounts.map((a) => (
              <li key={a.id} className="border-t border-line first:border-t-0">
                <Link to={`/super-admin/accounts/${a.id}`} className="grid min-h-11 gap-x-4 gap-y-1 px-4 py-3 text-ink no-underline hover:bg-cream sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <span className="flex min-w-0 flex-col">
                    <strong className="truncate">{a.name}</strong>
                    <span className="truncate text-sm text-muted">
                      {a.ownerName} · {a.ownerEmail}
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    {a.planCode ? <span>{planLabel(a.planCode, a.planName)}</span> : null}
                  </span>
                  <span className="text-sm text-muted sm:text-right">
                    {a.endsAt ? (a.status === "expired" ? `Ended ${day(a.endsAt)}` : `Ends ${day(a.endsAt)} · ${a.daysLeft} d`) : `Signed up ${day(a.createdAt)}`}
                    <br className="max-sm:hidden" />
                    <span className="max-sm:ml-2">
                      {a.branches} branch{a.branches === 1 ? "" : "es"}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
            {!data.accounts.length ? <li className="px-4 py-6 text-center text-muted">No accounts match.</li> : null}
          </ul>
          {data.total > PAGE ? (
            <div className="flex items-center gap-3">
              <Button variant="secondary" disabled={offset === 0} onClick={() => update({ offset: String(Math.max(0, offset - PAGE)) })}>
                Previous
              </Button>
              <span className="text-sm text-muted">
                {offset + 1}–{Math.min(offset + PAGE, data.total)} of {data.total}
              </span>
              <Button variant="secondary" disabled={offset + PAGE >= data.total} onClick={() => update({ offset: String(offset + PAGE) })}>
                Next
              </Button>
            </div>
          ) : null}
        </>
      ) : !error ? (
        <p className="text-muted">Loading…</p>
      ) : null}
    </div>
  );
}
