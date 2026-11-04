import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Card, Field, PageHeader } from "../components/ui";
import { ApiError, apiGet, apiPatch, apiPost, type Branch } from "../lib/api";
import { errorMessage } from "../lib/format";

type Draft = { name: string; address: string; phone: string; gstin: string; stateCode: string };
const empty: Draft = { name: "", address: "", phone: "", gstin: "", stateCode: "" };
const toDraft = (b: Branch): Draft => ({ name: b.name, address: b.address, phone: b.phone, gstin: b.gstin ?? "", stateCode: b.stateCode ?? "" });

function BranchForm({ initial, submitLabel, onSubmit, onCancel }: { initial: Draft; submitLabel: string; onSubmit: (d: Draft) => Promise<void>; onCancel: () => void }) {
  const [d, setD] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<{ message: string; limit: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement>) => setD({ ...d, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      await onSubmit(d);
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else if (err instanceof ApiError && err.code === "invalid_gstin") setErrors({ gstin: err.message });
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
          {error.limit ? (
            <Link to="/settings/plan" className="font-semibold underline">
              See plans
            </Link>
          ) : null}
        </Alert>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Branch name" required value={d.name} onChange={set("name")} error={errors.name} />
        <Field label="Phone" type="tel" value={d.phone} onChange={set("phone")} error={errors.phone} />
        <Field label="Address" value={d.address} onChange={set("address")} error={errors.address} className="md:col-span-2" />
        <Field label="GSTIN (optional)" value={d.gstin} onChange={set("gstin")} error={errors.gstin} hint="If this branch has its own GST registration." />
        <Field label="GST state code" inputMode="numeric" maxLength={2} value={d.stateCode} onChange={set("stateCode")} error={errors.stateCode} hint="Two digits, e.g. 29 for Karnataka. Filled from the GSTIN if blank." />
      </div>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" busy={busy} disabled={!d.name.trim()}>
          {submitLabel}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function BranchesPage() {
  const me = useMe();
  const { reloadMe } = useAuth();
  const [branches, setBranches] = useState<Branch[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<{ kind: "add" } | { kind: "edit"; branch: Branch } | null>(null);
  const limit = me.plan.current?.limits.maxBranches ?? null;

  const load = useCallback(() => {
    apiGet<{ branches: Branch[] }>("/branches").then((r) => setBranches(r.branches), (err: unknown) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  const clean = (d: Draft) => ({ ...d, gstin: d.gstin.trim(), stateCode: d.stateCode.trim() });
  const done = async () => {
    setMode(null);
    load();
    await reloadMe();
  };

  return (
    <div className="w-full">
      <PageHeader
        title="Branches"
        description={`${branches?.length ?? "…"} ${limit === null ? "" : `of ${limit} `}on your ${me.plan.current?.name ?? ""} plan · codes appear in bill numbers`}
        actions={mode ? null : <Button onClick={() => setMode({ kind: "add" })}>Add branch</Button>}
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      {mode ? (
        <Card className="mb-5">
          <h2 className="mt-0 mb-4 text-lg font-semibold">{mode.kind === "add" ? "New branch" : `Edit ${mode.branch.code}`}</h2>
          <BranchForm
            initial={mode.kind === "add" ? empty : toDraft(mode.branch)}
            submitLabel={mode.kind === "add" ? "Add branch" : "Save"}
            onCancel={() => setMode(null)}
            onSubmit={async (d) => {
              if (mode.kind === "add") await apiPost("/branches", clean(d));
              else await apiPatch(`/branches/${mode.branch.id}`, clean(d));
              await done();
            }}
          />
        </Card>
      ) : null}
      <div className="grid gap-3">
        {(branches ?? []).map((b) => (
          <Card key={b.id} className="flex flex-wrap items-center gap-4">
            <span className="flex size-12 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo">{b.code}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-semibold">{b.name}</span>
              <span className="text-sm text-muted">{[b.address, b.phone, b.gstin ? `GSTIN ${b.gstin}` : null].filter(Boolean).join(" · ") || "No address yet"}</span>
            </div>
            {b.withinPlan ? <Badge tone="ok">Active</Badge> : <Badge tone="muted">Read-only on this plan</Badge>}
            {b.withinPlan ? (
              <Button variant="secondary" onClick={() => setMode({ kind: "edit", branch: b })} aria-label={`Edit ${b.name}`}>
                Edit
              </Button>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
