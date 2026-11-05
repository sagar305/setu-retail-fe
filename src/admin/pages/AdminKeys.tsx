import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Badge, Button, Card, PageHeader } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { adminApi, type IssuedKey, type Redemption } from "../api";
import { MODE_LABEL, when } from "../text";

const lim = (n: number | null) => (n === null ? "unlimited" : n.toLocaleString("en-IN"));

export function AdminKeysPage() {
  const [keys, setKeys] = useState<IssuedKey[] | null>(null);
  const [redemptions, setRedemptions] = useState<Redemption[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.keys().then((r) => setKeys(r.keys), (e: unknown) => setError(errorMessage(e)));
    adminApi.redemptions().then(
      (r) => {
        setRedemptions(r.redemptions);
        setNext(r.next);
      },
      (e: unknown) => setError(errorMessage(e)),
    );
  }, []);

  async function more() {
    if (!next) return;
    const r = await adminApi.redemptions(next);
    setRedemptions((x) => [...(x ?? []), ...r.redemptions]);
    setNext(r.next);
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Keys" description="Contact-sales keys are issued from an account's page. Website keys appear here once redeemed." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Card>
        <h2 className="m-0 mb-3 text-lg font-semibold">Contact-sales keys issued</h2>
        {keys === null ? (
          <p className="m-0 text-muted">Loading…</p>
        ) : keys.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {keys.map((k) => (
              <li key={k.id} className="flex flex-col gap-1 border-b border-line pb-2 [overflow-wrap:anywhere] last:border-0">
                <span className="flex flex-wrap items-center gap-2">
                  <Link to={`/super-admin/accounts/${k.accountId}`} className="font-semibold text-indigo">
                    {k.accountName}
                  </Link>
                  {k.redeemedAt ? <Badge tone="ok">Redeemed {when(k.redeemedAt)}</Badge> : k.revokedAt ? <Badge tone="muted">Cancelled</Badge> : <Badge tone="info">Not redeemed</Badge>}
                </span>
                <span>
                  {k.days} days · {lim(k.limits.maxBranches)} branches · {lim(k.limits.maxStaff)} staff · {lim(k.limits.maxProducts)} products · {lim(k.limits.maxCustomers)} customers · {lim(k.limits.maxOrdersPerMonth)} bills/month
                </span>
                <span className="text-muted">
                  By {k.issuedBy}, {when(k.issuedAt)}
                  {k.note ? ` · ${k.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">None yet.</p>
        )}
      </Card>
      <Card>
        <h2 className="m-0 mb-3 text-lg font-semibold">All redeemed keys</h2>
        {redemptions === null ? (
          <p className="m-0 text-muted">Loading…</p>
        ) : redemptions.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {redemptions.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-2 last:border-0">
                <Link to={`/super-admin/accounts/${r.accountId}`} className="font-semibold text-indigo">
                  {r.accountName}
                </Link>
                <span>
                  {r.custom ? "Custom" : r.planCode.charAt(0).toUpperCase() + r.planCode.slice(1)} · {r.days} days
                </span>
                <span className="text-muted">{MODE_LABEL[r.mode] ?? r.mode}</span>
                <span className="ml-auto text-muted">{when(r.redeemedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-sm text-muted">None yet.</p>
        )}
        {next ? (
          <Button variant="secondary" className="mt-3" onClick={() => void more()}>
            Show older
          </Button>
        ) : null}
      </Card>
    </div>
  );
}
