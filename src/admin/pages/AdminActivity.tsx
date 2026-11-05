import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, PageHeader, SelectField } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { adminApi, type Activity, type Admin } from "../api";
import { ACTIVITY_GROUPS, describeActivity, when } from "../text";

export function AdminActivityPage() {
  const [action, setAction] = useState("");
  const [adminId, setAdminId] = useState("");
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [entries, setEntries] = useState<Activity[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.admins().then((r) => setAdmins(r.admins), () => {});
  }, []);
  useEffect(() => {
    adminApi.activity({ action, adminId }).then(
      (r) => {
        setEntries(r.entries);
        setNext(r.next);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, [action, adminId]);

  async function more() {
    if (!next) return;
    const r = await adminApi.activity({ action, adminId, before: next });
    setEntries((x) => [...(x ?? []), ...r.entries]);
    setNext(r.next);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Activity" description="Everything the Setu team did, and the daily reminder job. Newest first." />
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <SelectField label="What" value={action} onChange={(e) => setAction(e.target.value)}>
          {ACTIVITY_GROUPS.map((g) => (
            <option key={g.prefix} value={g.prefix}>
              {g.label}
            </option>
          ))}
        </SelectField>
        <SelectField label="Who" value={adminId} onChange={(e) => setAdminId(e.target.value)}>
          <option value="">Everyone</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </SelectField>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <ol className="m-0 flex list-none flex-col rounded-2xl border border-line bg-white p-0">
        {(entries ?? []).map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 border-t border-line px-4 py-3 text-sm [overflow-wrap:anywhere] first:border-t-0">
            <span>{describeActivity(e)}</span>
            <span className="text-muted">
              {e.adminName || "System"} · {when(e.createdAt)}
              {e.accountId ? (
                <>
                  {" · "}
                  <Link to={`/super-admin/accounts/${e.accountId}`} className="font-semibold text-indigo">
                    {e.accountName}
                  </Link>
                </>
              ) : null}
              {e.ip ? ` · ${e.ip}` : ""}
            </span>
          </li>
        ))}
        {entries && !entries.length ? <li className="px-4 py-5 text-center text-muted">Nothing yet.</li> : null}
        {!entries ? <li className="px-4 py-5 text-center text-muted">Loading…</li> : null}
      </ol>
      {next ? (
        <Button variant="secondary" onClick={() => void more()}>
          Show older
        </Button>
      ) : null}
    </div>
  );
}
