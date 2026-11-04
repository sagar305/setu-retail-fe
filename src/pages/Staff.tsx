import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Card, Field, PageHeader, SelectField } from "../components/ui";
import { ApiError, apiGet, apiPatch, apiPost, type Staff } from "../lib/api";
import { errorMessage, formatDate } from "../lib/format";
import { ROLE_LABEL } from "../lib/roles";

type Invite = { name: string; email: string; username: string; role: "MANAGER" | "CASHIER"; branchIds: string[] };

function InviteForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const me = useMe();
  const isOwner = me.user.role === "OWNER";
  const usable = me.branches.filter((b) => b.withinPlan);
  const [d, setD] = useState<Invite>({ name: "", email: "", username: "", role: "CASHIER", branchIds: usable.length === 1 ? [usable[0]!.id] : [] });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: "name" | "email" | "username") => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  const toggleBranch = (id: string) => {
    if (d.role === "CASHIER") return setD({ ...d, branchIds: [id] });
    setD({ ...d, branchIds: d.branchIds.includes(id) ? d.branchIds.filter((x) => x !== id) : [...d.branchIds, id] });
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await apiPost("/staff", d);
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === "email_taken") setErrors({ email: err.message });
      else if (err instanceof ApiError && err.code === "username_taken") setErrors({ username: err.message });
      else setError({ message: errorMessage(err), limit: err instanceof ApiError && err.code === "plan_limit" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {error ? (
        <Alert tone="error">
          {error.message}{" "}
          {error.limit && isOwner ? (
            <Link to="/settings/plan" className="font-semibold underline">
              See plans
            </Link>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Name" required value={d.name} onChange={set("name")} error={errors.name} />
        <Field label="Email" type="email" required value={d.email} onChange={set("email")} error={errors.email} hint="The invite link goes here." />
        <Field label="Username" required value={d.username} onChange={set("username")} error={errors.username} hint="They can sign in with this or the email." />
        <SelectField
          label="Role"
          value={d.role}
          onChange={(e) => {
            const role = e.target.value as Invite["role"];
            setD({ ...d, role, branchIds: role === "CASHIER" ? d.branchIds.slice(0, 1) : d.branchIds });
          }}
        >
          <option value="CASHIER">Cashier — billing in one branch</option>
          {isOwner ? <option value="MANAGER">Manager — runs one or more branches</option> : null}
        </SelectField>
      </div>
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="mb-2 text-sm font-medium">{d.role === "CASHIER" ? "Branch" : "Branches"}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {usable.map((b) => (
            <label key={b.id} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${d.branchIds.includes(b.id) ? "border-2 border-indigo" : "border-line"}`}>
              <input
                type={d.role === "CASHIER" ? "radio" : "checkbox"}
                name="branch"
                checked={d.branchIds.includes(b.id)}
                onChange={() => toggleBranch(b.id)}
                className="size-[18px] accent-indigo"
              />
              <span className="text-sm">
                <strong>{b.code}</strong> · {b.name}
              </span>
            </label>
          ))}
        </div>
        {errors.branchIds ? <span className="text-[13px] text-[#A3361F]">{errors.branchIds}</span> : null}
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy} disabled={!d.name || !d.email || !d.username || d.branchIds.length === 0}>
          Send invite
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function statusBadge(s: Staff) {
  if (s.status === "DISABLED") return <Badge tone="muted">Access removed</Badge>;
  if (!s.withinPlan) return <Badge tone="muted">Can't sign in on this plan</Badge>;
  if (s.status === "INVITED") return <Badge tone="warn">Invite sent</Badge>;
  return <Badge tone="ok">Active</Badge>;
}

export function StaffPage() {
  const me = useMe();
  const [staff, setStaff] = useState<Staff[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const codeOf = new Map(me.branches.map((b) => [b.id, b.code]));
  const limit = me.plan.current?.limits.maxStaff ?? null;
  const counted = (staff ?? []).filter((s) => s.role !== "OWNER" && s.status !== "DISABLED").length;

  const load = useCallback(() => {
    apiGet<{ staff: Staff[] }>("/staff").then((r) => setStaff(r.staff), (err: unknown) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  async function act(fn: () => Promise<unknown>, message: string) {
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(message);
      load();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="w-full">
      <PageHeader
        title="Staff"
        description={me.user.role === "OWNER" ? `${counted}${limit === null ? "" : ` of ${limit}`} staff logins on your plan` : "Cashiers in your branches"}
        actions={inviting ? null : <Button onClick={() => setInviting(true)}>Add staff</Button>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="ok">{notice}</Alert> : null}
      {inviting ? (
        <Card className="my-5">
          <h2 className="mt-0 mb-1 text-lg font-semibold">Add staff</h2>
          <p className="mt-0 mb-4 text-sm text-muted">We'll email them a link to set their own password.</p>
          <InviteForm
            onCancel={() => setInviting(false)}
            onDone={() => {
              setInviting(false);
              setNotice("Invite sent.");
              load();
            }}
          />
        </Card>
      ) : null}
      <div className="mt-3 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-3 py-3 font-medium">Role</th>
              <th className="px-3 py-3 font-medium">Branches</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium">Last sign-in</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {(staff ?? []).map((s) => (
              <tr key={s.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold">{s.name}</span>
                    <span className="text-xs text-muted">
                      {s.username} · {s.email}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3">{ROLE_LABEL[s.role]}</td>
                <td className="px-3 py-3">{s.role === "OWNER" ? "All" : s.branchIds.map((id) => codeOf.get(id) ?? "—").join(", ")}</td>
                <td className="px-3 py-3">{statusBadge(s)}</td>
                <td className="px-3 py-3 text-muted">{s.lastLoginAt ? formatDate(s.lastLoginAt, me.account.timezone) : "—"}</td>
                <td className="px-3 py-3 text-right">
                  {s.role !== "OWNER" && s.id !== me.user.id ? (
                    <div className="flex justify-end gap-2">
                      {s.status === "INVITED" ? (
                        <Button variant="ghost" onClick={() => act(() => apiPost(`/staff/${s.id}/resend-invite`), `Invite sent again to ${s.email}.`)}>
                          Resend invite
                        </Button>
                      ) : null}
                      {s.status === "DISABLED" ? (
                        <Button variant="secondary" onClick={() => act(() => apiPatch(`/staff/${s.id}`, { disabled: false }), `${s.name} can sign in again.`)}>
                          Restore access
                        </Button>
                      ) : (
                        <Button variant="danger" onClick={() => act(() => apiPatch(`/staff/${s.id}`, { disabled: true }), `${s.name} has been signed out and can't sign in.`)}>
                          Remove access
                        </Button>
                      )}
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
