import { useEffect, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, Field, PageHeader } from "../../components/ui";
import { errorMessage } from "../../lib/format";
import { adminApi, type Admin } from "../api";
import { useAdmin } from "../AdminAuth";
import { when } from "../text";

const STATUS: Record<Admin["status"], { label: string; tone: "ok" | "info" | "muted" }> = {
  ACTIVE: { label: "Active", tone: "ok" },
  INVITED: { label: "Invite sent", tone: "info" },
  DISABLED: { label: "Turned off", tone: "muted" },
};

export function AdminTeamPage() {
  const me = useAdmin();
  const [admins, setAdmins] = useState<Admin[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => adminApi.admins().then((r) => setAdmins(r.admins), (e: unknown) => setError(errorMessage(e)));
  useEffect(() => {
    void load();
  }, []);

  async function act(key: string, run: () => Promise<string>) {
    setBusy(key);
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

  function invite(e: FormEvent) {
    e.preventDefault();
    void act("invite", async () => {
      const r = await adminApi.invite(email.trim(), name.trim());
      setEmail("");
      setName("");
      return `Invite sent to ${r.admin.email}. They set a password, then link an authenticator app.`;
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Team" description="Setu staff who can use this admin. Each signs in with a password and an authenticator app." />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      <ul className="m-0 flex list-none flex-col rounded-2xl border border-line bg-white p-0">
        {(admins ?? []).map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-4 py-3 first:border-t-0">
            <span className="flex min-w-0 flex-1 flex-col">
              <strong className="[overflow-wrap:anywhere]">
                {a.name}
                {a.id === me.id ? " (you)" : ""}
              </strong>
              <span className="text-sm text-muted [overflow-wrap:anywhere]">
                {a.email} · {a.lastLoginAt ? `last sign-in ${when(a.lastLoginAt)}` : "never signed in"}
              </span>
            </span>
            <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
            {a.id !== me.id ? (
              <span className="flex gap-2">
                {a.status !== "DISABLED" ? (
                  <>
                    <Button
                      variant="ghost"
                      busy={busy === `r${a.id}`}
                      onClick={() => {
                        if (window.confirm(`Reset ${a.name}'s sign-in? Their password and authenticator app stop working, and they get a new set-password link.`)) void act(`r${a.id}`, async () => (await adminApi.resetAdmin(a.id), `New link sent to ${a.email}.`));
                      }}
                    >
                      Reset sign-in
                    </Button>
                    <Button
                      variant="danger"
                      busy={busy === `d${a.id}`}
                      onClick={() => {
                        if (window.confirm(`Turn off ${a.name}? They are signed out at once.`)) void act(`d${a.id}`, async () => (await adminApi.disableAdmin(a.id), `${a.name} is turned off.`));
                      }}
                    >
                      Turn off
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" busy={busy === `e${a.id}`} onClick={() => void act(`e${a.id}`, async () => (await adminApi.enableAdmin(a.id), `${a.name} is back on; a new set-password link was sent.`))}>
                    Turn back on
                  </Button>
                )}
              </span>
            ) : null}
          </li>
        ))}
        {!admins ? <li className="px-4 py-5 text-center text-muted">Loading…</li> : null}
      </ul>
      <Card>
        <h2 className="m-0 mb-3 text-lg font-semibold">Invite a team member</h2>
        <form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={invite} noValidate>
          <Field label="Name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Field label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" busy={busy === "invite"} disabled={!email.trim() || !name.trim()}>
            Send invite
          </Button>
        </form>
      </Card>
    </div>
  );
}
