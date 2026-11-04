import { useCallback, useEffect, useState } from "react";
import { useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Field, PageHeader, SelectField } from "../components/ui";
import { apiGet, type AuditEntry } from "../lib/api";
import { downloadCsv, toCsv } from "../lib/csv";
import { errorMessage } from "../lib/format";
import { ROLE_LABEL } from "../lib/roles";
import { describeAudit } from "../lib/auditText";

type Filters = { from: string; to: string; userId: string; branchId: string; action: string };
const GROUPS: { prefix: string; label: string }[] = [
  { prefix: "", label: "Everything" },
  { prefix: "auth.", label: "Sign-ins" },
  { prefix: "order.", label: "Bills: cancels & returns" },
  { prefix: "product.", label: "Products, prices & stock" },
  { prefix: "transfer.", label: "Transfers" },
  { prefix: "ledger.", label: "Payments & udhaar" },
  { prefix: "expense.", label: "Expenses" },
  { prefix: "cash_book.", label: "Cash book" },
  { prefix: "purchase.", label: "Supplier bills" },
  { prefix: "staff.", label: "Staff" },
  { prefix: "settings.", label: "Settings" },
  { prefix: "license.", label: "Plan & keys" },
  { prefix: "import.", label: "Imports" },
  { prefix: "sync.", label: "Offline sync" },
];

/** Audit log: who did what, when and where. */
export function AuditLogPage() {
  const me = useMe();
  const tz = me.account.timezone;
  const [f, setF] = useState<Filters>({ from: "", to: "", userId: "", branchId: "", action: "" });
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; name: string; role: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const query = useCallback((before?: string) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    if (before) p.set("before", before);
    p.set("limit", "100");
    return `/audit-log?${p}`;
  }, [f]);

  useEffect(() => {
    apiGet<{ users: { id: string; name: string; role: string }[] }>("/audit-log/filters").then((r) => setUsers(r.users), () => {});
  }, []);
  useEffect(() => {
    apiGet<{ entries: AuditEntry[]; next: string | null }>(query()).then(
      (r) => {
        setEntries(r.entries);
        setNext(r.next);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [query]);

  async function more() {
    if (!next) return;
    const r = await apiGet<{ entries: AuditEntry[]; next: string | null }>(query(next));
    setEntries((x) => [...(x ?? []), ...r.entries]);
    setNext(r.next);
  }
  const when = (iso: string) => new Date(iso).toLocaleString("en-IN", { timeZone: tz, dateStyle: "medium", timeStyle: "short" });
  const set = (k: keyof Filters) => (v: string) => setF((x) => ({ ...x, [k]: v }));

  return (
    <div className="w-full">
      <PageHeader
        title="Audit log"
        description={`Who did what, when and in which branch. ${me.user.role === "MANAGER" ? "You see your branches and your own actions. " : ""}Kept for 2 years.`}
        actions={
          <Button variant="secondary" disabled={!entries?.length} onClick={() => downloadCsv("Audit_log.csv", toCsv(["When", "Who", "Role", "Branch", "What", "Details", ...(me.user.role === "OWNER" ? ["IP"] : [])], (entries ?? []).map((e) => [when(e.createdAt), e.userName, e.role ? ROLE_LABEL[e.role as keyof typeof ROLE_LABEL] : "", e.branchCode ?? "", describeAudit(e).title, describeAudit(e).details.join("; "), ...(me.user.role === "OWNER" ? [e.ip ?? ""] : [])])))}>
            Export CSV
          </Button>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <SelectField label="What" value={f.action} onChange={(e) => set("action")(e.target.value)}>
          {GROUPS.map((g) => (
            <option key={g.prefix} value={g.prefix}>
              {g.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Who" value={f.userId} onChange={(e) => set("userId")(e.target.value)}>
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </SelectField>
        {me.branches.length > 1 ? (
          <SelectField label="Branch" value={f.branchId} onChange={(e) => set("branchId")(e.target.value)}>
            <option value="">All branches</option>
            {me.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </SelectField>
        ) : null}
        <Field label="From" type="date" value={f.from} onChange={(e) => set("from")(e.target.value)} />
        <Field label="To" type="date" value={f.to} onChange={(e) => set("to")(e.target.value)} />
      </div>
      <ol className="m-0 flex list-none flex-col rounded-2xl border border-line bg-white p-0">
        {(entries ?? []).map((e) => {
          const d = describeAudit(e);
          return (
            <li key={e.id} className="flex flex-col gap-1 border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-40 shrink-0 text-[13px] text-muted">{when(e.createdAt)}</span>
                <span className="min-w-0 flex-1">
                  <strong className={d.tone === "warn" ? "text-[#A3361F]" : ""}>{d.title}</strong>
                  {d.details.length ? <span className="text-sm text-muted"> · {d.details[0]}</span> : null}
                </span>
                {e.branchCode ? <Badge tone="muted">{e.branchCode}</Badge> : null}
                <span className="text-sm">
                  {e.userName}
                  {e.role ? <span className="text-muted"> · {ROLE_LABEL[e.role as keyof typeof ROLE_LABEL]}</span> : null}
                </span>
                {d.details.length > 1 || e.ip ? (
                  <Button variant="ghost" aria-expanded={open === e.id} onClick={() => setOpen(open === e.id ? null : e.id)}>
                    {open === e.id ? "Less" : "More"}
                  </Button>
                ) : null}
              </div>
              {open === e.id ? (
                <ul className="m-0 ml-0 flex list-disc flex-col gap-0.5 pl-5 text-sm text-muted sm:ml-40">
                  {d.details.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                  {e.ip ? <li>From {e.ip}</li> : null}
                </ul>
              ) : null}
            </li>
          );
        })}
        {entries && !entries.length ? <li className="px-4 py-5 text-center text-muted">Nothing matches.</li> : null}
        {!entries ? <li className="px-4 py-5 text-center text-muted">Loading…</li> : null}
      </ol>
      {next ? (
        <Button variant="secondary" className="mt-3" onClick={() => void more()}>
          Show older
        </Button>
      ) : null}
    </div>
  );
}
