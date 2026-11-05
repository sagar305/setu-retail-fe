import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { Alert, Badge, Button, Card, Field, Modal, UsageBar } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { adminApi, type AccountDetail, type IssueKeyInput } from "../api";
import { day, describeActivity, MODE_LABEL, planLabel, SOURCE_LABEL, STATUS_LABEL, STATUS_TONE, when } from "../text";

type Dialog = "lock" | "unlock" | "days" | "key" | null;

function Section({ title, children, empty }: { title: string; children: ReactNode; empty?: boolean }) {
  return (
    <Card>
      <h2 className="m-0 mb-3 text-lg font-semibold">{title}</h2>
      {empty ? <p className="m-0 text-sm text-muted">None yet.</p> : children}
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  );
}

/** A small form inside a modal: one reason/number field and a submit. */
function ActionForm({ submitLabel, danger, onSubmit, children }: { submitLabel: string; danger?: boolean; onSubmit: () => Promise<void>; children: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit();
    } catch (err) {
      const fe = err instanceof ApiError ? Object.values(err.fieldErrors)[0] : undefined;
      setError(fe || errorMessage(err));
      setBusy(false);
    }
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {children}
      <Button type="submit" variant={danger ? "danger" : "primary"} busy={busy}>
        {submitLabel}
      </Button>
    </form>
  );
}

const LIMITS: { key: keyof Omit<IssueKeyInput, "accountId" | "days" | "note" | "maxBranches">; label: string; start: string }[] = [
  { key: "maxStaff", label: "Staff logins", start: "1000" },
  { key: "maxProducts", label: "Products", start: "" },
  { key: "maxCustomers", label: "Customers", start: "" },
  { key: "maxOrdersPerMonth", label: "Bills a month", start: "" },
];

function IssueKey({ account, onIssued }: { account: AccountDetail["account"]; onIssued: () => void }) {
  const [days, setDays] = useState("365");
  const [branches, setBranches] = useState("150");
  const [limits, setLimits] = useState<Record<string, string>>(Object.fromEntries(LIMITS.map((l) => [l.key, l.start])));
  const [note, setNote] = useState("");
  const [issued, setIssued] = useState<{ key: string; emailedTo: string | null } | null>(null);
  const [copied, setCopied] = useState(false);
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  if (issued) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="ok">{issued.emailedTo ? `Issued and emailed to ${issued.emailedTo}.` : "Issued. The email didn't go out: send the key to the owner yourself."}</Alert>
        <p className="m-0 text-sm">Copy it now: for safety the key is not shown again. It only works on {account.name}.</p>
        <code className="rounded-xl bg-cream p-3 text-sm break-all select-all">{issued.key}</code>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard?.writeText(issued.key).then(() => setCopied(true), () => {});
          }}
        >
          {copied ? "Copied" : "Copy key"}
        </Button>
        <Button onClick={onIssued}>Done</Button>
      </div>
    );
  }
  return (
    <ActionForm
      submitLabel="Issue key"
      onSubmit={async () => {
        const body: IssueKeyInput = { accountId: account.id, days: Number(days), maxBranches: Number(branches), note: note.trim(), ...(Object.fromEntries(LIMITS.map((l) => [l.key, num(limits[l.key] ?? "")])) as Pick<IssueKeyInput, "maxStaff" | "maxProducts" | "maxCustomers" | "maxOrdersPerMonth">) };
        const r = await adminApi.issueKey(body);
        setIssued({ key: r.key, emailedTo: r.emailedTo });
      }}
    >
      <p className="m-0 text-sm text-muted">For Contact-sales deals above 100 branches, after payment is received. The key works only on this account and is emailed to the owner.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Days" type="number" inputMode="numeric" min={1} max={3660} required value={days} onChange={(e) => setDays(e.target.value)} />
        <Field label="Branches" type="number" inputMode="numeric" min={101} required value={branches} onChange={(e) => setBranches(e.target.value)} hint="More than 100." />
        {LIMITS.map((l) => (
          <Field key={l.key} label={l.label} type="number" inputMode="numeric" min={1} placeholder="Unlimited" value={limits[l.key]} onChange={(e) => setLimits((x) => ({ ...x, [l.key]: e.target.value }))} hint="Leave empty for unlimited." />
        ))}
      </div>
      <Field label="Note (deal, PO or invoice number)" value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} />
    </ActionForm>
  );
}

export function AdminAccountPage() {
  const { id = "" } = useParams();
  const [d, setD] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("30");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => adminApi.account(id).then(setD, (e: unknown) => setError(errorMessage(e))), [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const open = (k: Dialog) => {
    setReason("");
    setDialog(k);
  };
  const close = () => setDialog(null);
  const finish = async (message: string) => {
    setDialog(null);
    setNotice(message);
    await load();
  };
  async function quick(name: string, run: () => Promise<string>) {
    setBusy(name);
    setError(null);
    setNotice(null);
    try {
      setNotice(await run());
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  if (!d) return error ? <Alert tone="error">{error}</Alert> : <p className="text-muted">Loading…</p>;
  const { account: a, plan, usage } = d;
  const limits = plan.limits;

  return (
    <div className="flex flex-col gap-4">
      <Link to="/super-admin/accounts" className="text-sm font-semibold text-indigo">
        ← Accounts
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="m-0 mr-auto min-w-0 text-2xl font-semibold [overflow-wrap:anywhere]">{a.name}</h1>
        <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {a.lockedAt ? (
        <Alert tone="error">
          Locked on {when(a.lockedAt)}: {a.lockReason}. The shop's users see "This account is locked. Contact Setu support."
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" busy={busy === "remind"} onClick={() => void quick("remind", async () => (await adminApi.remind(a.id), "Reminder sent to the owner."))}>
          Send plan reminder
        </Button>
        <Button variant="secondary" onClick={() => open("days")}>
          Add free days
        </Button>
        <Button variant="secondary" onClick={() => open("key")}>
          Issue Contact-sales key
        </Button>
        {a.ownerVerified ? (
          <Button variant="secondary" busy={busy === "reset"} onClick={() => void quick("reset", async () => `Password reset link sent to ${(await adminApi.sendReset(a.id)).to}.`)}>
            Send password reset
          </Button>
        ) : (
          <Button variant="secondary" busy={busy === "verify"} onClick={() => void quick("verify", async () => `Verification link sent to ${(await adminApi.resendVerification(a.id)).to}.`)}>
            Resend verification email
          </Button>
        )}
        {a.lockedAt ? (
          <Button variant="secondary" onClick={() => open("unlock")}>
            Unlock account
          </Button>
        ) : (
          <Button variant="danger" onClick={() => open("lock")}>
            Lock account
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Owner & contact">
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            <Row label="Owner">{a.ownerName}</Row>
            <Row label="Email">
              {a.ownerEmail} {a.ownerVerified ? null : <Badge tone="warn">Not verified</Badge>}
            </Row>
            <Row label="Phone">{a.phone}</Row>
            <Row label="GSTIN / tax no.">{a.taxNumber ?? "—"}</Row>
            <Row label="Signed up">{day(a.createdAt)}</Row>
            <Row label="Last sign-in">{a.lastActiveAt ? when(a.lastActiveAt) : "—"}</Row>
            <Row label="Time zone">{a.timezone}</Row>
          </dl>
        </Section>
        <Section title="Plan & usage">
          <p className="m-0 mb-3 text-sm">
            {plan.expired ? (
              <strong>No plan running{a.endsAt ? ` · ended ${day(a.endsAt)}` : " · trial not started"}</strong>
            ) : (
              <>
                <strong>{planLabel(plan.code, plan.name)}</strong> · {SOURCE_LABEL[plan.source ?? ""] ?? plan.source} · ends {a.endsAt ? day(a.endsAt) : "—"} ({a.daysLeft} days)
              </>
            )}
          </p>
          <div className="flex flex-col gap-3">
            <UsageBar label="Branches" used={usage.branches} max={limits?.maxBranches ?? null} />
            <UsageBar label="Staff logins" used={usage.staff} max={limits?.maxStaff ?? null} />
            <UsageBar label="Products" used={usage.products} max={limits?.maxProducts ?? null} />
            <UsageBar label="Customers" used={usage.customers} max={limits?.maxCustomers ?? null} />
            <UsageBar label="Bills this month" used={usage.ordersThisMonth} max={limits?.maxOrdersPerMonth ?? null} />
          </div>
        </Section>
      </div>

      <Section title="Plan timeline" empty={!d.timeline.length}>
        <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
          {d.timeline.map((t) => (
            <li key={t.startsAt} className="flex flex-wrap gap-x-3 border-b border-line pb-2 last:border-0">
              <strong>{planLabel(t.planCode, t.planName)}</strong>
              <span className="text-muted">{SOURCE_LABEL[t.source] ?? t.source}</span>
              <span className="ml-auto">
                {day(t.startsAt)} → {day(t.endsAt)}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Keys redeemed" empty={!d.redemptions.length}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {d.redemptions.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-x-3 border-b border-line pb-2 last:border-0">
                <strong>{r.custom ? "Custom" : r.planCode.charAt(0).toUpperCase() + r.planCode.slice(1)}</strong> {r.days} days
                <span className="text-muted">
                  {MODE_LABEL[r.mode] ?? r.mode}
                  {r.convertedDays ? ` · +${r.convertedDays} converted` : ""}
                </span>
                <span className="ml-auto">{when(r.redeemedAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Contact-sales keys issued" empty={!d.issuedKeys.length}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {d.issuedKeys.map((k) => (
              <li key={k.id} className="flex flex-col gap-1 border-b border-line pb-2 last:border-0">
                <span className="flex flex-wrap items-center gap-2">
                  <strong>
                    {k.days} days · {k.limits.maxBranches} branches
                  </strong>
                  {k.redeemedAt ? <Badge tone="ok">Redeemed</Badge> : k.revokedAt ? <Badge tone="muted">Cancelled</Badge> : <Badge tone="info">Not redeemed</Badge>}
                  {!k.redeemedAt && !k.revokedAt ? (
                    <Button
                      variant="ghost"
                      className="ml-auto"
                      busy={busy === k.id}
                      onClick={() => {
                        if (window.confirm("Cancel this key? It will no longer redeem.")) void quick(k.id, async () => (await adminApi.revokeKey(k.id), "Key cancelled."));
                      }}
                    >
                      Cancel key
                    </Button>
                  ) : null}
                </span>
                <span className="text-muted">
                  By {k.issuedBy}, {when(k.issuedAt)}
                  {k.note ? ` · ${k.note}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Plan reminders sent" empty={!d.reminders.length}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {d.reminders.map((r) => (
              <li key={r.sentAt + r.step} className="flex flex-wrap gap-x-3 border-b border-line pb-2 last:border-0">
                <span>{r.manual ? "Sent by the Setu team" : `Automatic · ${r.step} day${r.step === 1 ? "" : "s"} before`}</span>
                <span className="ml-auto text-muted">{when(r.sentAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Setu team activity" empty={!d.activity.length}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm">
            {d.activity.map((e) => (
              <li key={e.id} className="flex flex-col border-b border-line pb-2 [overflow-wrap:anywhere] last:border-0">
                <span>{describeActivity(e)}</span>
                <span className="text-muted">
                  {e.adminName || "System"} · {when(e.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      {dialog === "lock" ? (
        <Modal title="Lock account" onClose={close}>
          <ActionForm danger submitLabel="Lock account" onSubmit={async () => (await adminApi.lock(a.id, reason), await finish("Account locked."))}>
            <p className="m-0 text-sm text-muted">Everyone in {a.name} is stopped at once, including counters. They see a "contact Setu support" message; the reason stays with the Setu team.</p>
            <Field label="Reason" required autoFocus value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </ActionForm>
        </Modal>
      ) : null}
      {dialog === "unlock" ? (
        <Modal title="Unlock account" onClose={close}>
          <ActionForm submitLabel="Unlock account" onSubmit={async () => (await adminApi.unlock(a.id, reason), await finish("Account unlocked."))}>
            <p className="m-0 text-sm text-muted">Locked because: {a.lockReason}</p>
            <Field label="Note (optional)" value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </ActionForm>
        </Modal>
      ) : null}
      {dialog === "days" ? (
        <Modal title="Add free days" onClose={close}>
          <ActionForm
            submitLabel="Add days"
            onSubmit={async () => {
              const r = await adminApi.addDays(a.id, Number(days), reason);
              await finish(`Added. The plan now runs to ${day(r.endsAt)}.`);
            }}
          >
            <p className="m-0 text-sm text-muted">Free days of {plan.expired ? "their last plan" : `the current plan (${planLabel(plan.code, plan.name)})`}, added after everything already on the timeline. The owner sees them in their audit log as added by Setu.</p>
            <Field label="Days" type="number" inputMode="numeric" min={1} max={365} required value={days} onChange={(e) => setDays(e.target.value)} hint="1 to 365." />
            <Field label="Reason" required value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
          </ActionForm>
        </Modal>
      ) : null}
      {dialog === "key" ? (
        <Modal title="Issue Contact-sales key" onClose={close} wide>
          <IssueKey account={a} onIssued={() => void finish("Key issued.")} />
        </Modal>
      ) : null}
    </div>
  );
}
