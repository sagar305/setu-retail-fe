import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth, useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Card, PageHeader, UsageBar } from "../components/ui";
import { apiGet, apiPost, type Plan } from "../lib/api";
import { errorMessage, formatDate } from "../lib/format";

type PlanResponse = { plan: Plan; usage: Record<string, number>; keepActiveReviewPending: boolean };
type Check = {
  plan: { code: string; name: string };
  days: number;
  needsChoice: boolean;
  options: { choice: "now" | "later" | null; convertedDays: number; startsAt: string; endsAt: string }[];
};

/** Plan prices on setutechnology.com, GST included. */
const PRICES = [
  { name: "Basic", branches: "1 branch", inr: "₹249/mo · ₹2,499/yr", usd: "$4.99/mo · $49.99/yr" },
  { name: "Gold", branches: "Up to 10 branches", inr: "₹499/mo · ₹4,999/yr", usd: "$9.99/mo · $99.99/yr" },
  { name: "Platinum", branches: "Up to 100 branches", inr: "₹999/mo · ₹9,999/yr", usd: "$19.99/mo · $199.99/yr" },
];
export const BUY_URL = "https://setutechnology.com/products/retail";

export function PlanPage() {
  const me = useMe();
  const { reloadMe } = useAuth();
  const tz = me.account.timezone;
  const [data, setData] = useState<PlanResponse | null>(null);
  const [key, setKey] = useState("");
  const [check, setCheck] = useState<Check | null>(null);
  const [choice, setChoice] = useState<"now" | "later">("now");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiGet<PlanResponse>("/account/plan").then(setData, (err: unknown) => setError(errorMessage(err)));
  }, []);
  useEffect(load, [load]);

  async function doCheck(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    setCheck(null);
    try {
      setCheck(await apiPost<Check>("/account/license/check", { key }));
      setChoice("now");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    if (!check) return;
    setBusy(true);
    setError(null);
    try {
      const res = await apiPost<{ plan: Plan; keepActiveReviewPending: boolean }>("/account/license/redeem", check.needsChoice ? { key, choice } : { key });
      // Show the new plan straight away, then refresh usage and the session.
      setData((prev) => (prev ? { ...prev, plan: res.plan, keepActiveReviewPending: res.keepActiveReviewPending } : prev));
      setKey("");
      setCheck(null);
      await Promise.all([reloadMe(), apiGet<PlanResponse>("/account/plan").then(setData)]);
      setNotice(`${check.plan.name} key redeemed.`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const plan = data?.plan ?? me.plan;
  const current = plan.current;
  const limits = current?.limits;
  const u = data?.usage;

  return (
    <div className="w-full">
      <PageHeader title="Plan & license key" description="Only the owner sees this page." />
      {plan.expired ? (
        <div className="mb-4">
          <Alert tone="warn">
            <strong>Your plan has ended.</strong> Staff can't sign in until you redeem a key. Your data is safe. Offline counters keep billing, and their bills sync once the plan is active again.
          </Alert>
        </div>
      ) : null}
      {data?.keepActiveReviewPending ? (
        <div className="mb-4">
          <Alert tone="warn">
            Your plan has fewer branches or staff than you use.{" "}
            <Link to="/keep-active" className="font-semibold underline">
              Choose what stays active
            </Link>
          </Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4">
          <Alert tone="ok">{notice}</Alert>
        </div>
      ) : null}
      <div className="flex flex-wrap items-start gap-5">
        <Card className="flex flex-[1_1_340px] flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-sm font-medium text-muted">Current plan</h2>
              <span className="text-[28px] font-bold text-indigo">{current ? current.name : "None"}</span>
              <span className="text-[13px] text-muted">
                {current ? `${current.source === "TRIAL" ? "Free trial · " : ""}Ends ${formatDate(current.endsAt, tz)} · ${plan.daysLeft} days left` : "Redeem a key to continue"}
              </span>
            </div>
            {current ? <Badge tone={current.source === "TRIAL" ? "info" : "ok"}>{current.source === "TRIAL" ? "Trial" : "Active"}</Badge> : <Badge tone="warn">Ended</Badge>}
          </div>
          {plan.queued.map((q) => (
            <p key={q.startsAt} className="m-0 rounded-lg bg-cream px-3 py-2 text-[13px]">
              Next: <strong>{q.name}</strong> from {formatDate(q.startsAt, tz)} to {formatDate(q.endsAt, tz)}
            </p>
          ))}
          {limits && u ? (
            <div className="flex flex-col gap-3.5">
              <UsageBar label="Branches" used={u.branches ?? 0} max={limits.maxBranches} />
              <UsageBar label="Staff logins" used={u.staff ?? 0} max={limits.maxStaff} />
              <UsageBar label="Products" used={u.products ?? 0} max={limits.maxProducts} />
              <UsageBar label="Customers" used={u.customers ?? 0} max={limits.maxCustomers} />
              <UsageBar label="Orders this month" used={u.ordersThisMonth ?? 0} max={limits.maxOrdersPerMonth} />
            </div>
          ) : null}
        </Card>

        <Card className="flex flex-[1_1_440px] flex-col gap-4">
          <h2 className="m-0 text-lg font-semibold">Redeem a license key</h2>
          <form onSubmit={doCheck} className="flex flex-col gap-2">
            <label htmlFor="license-key" className="text-sm font-medium">
              License key from your setutechnology.com receipt
            </label>
            <div className="flex flex-wrap gap-2.5">
              <input
                id="license-key"
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setCheck(null);
                }}
                placeholder="SETU-R-…"
                autoComplete="off"
                spellCheck={false}
                className="h-12 min-w-0 flex-[1_1_240px] rounded-[10px] border border-line-strong bg-white px-3.5 font-mono text-sm text-ink"
              />
              <Button type="submit" busy={busy && !check} disabled={key.trim().length < 10}>
                Check key
              </Button>
            </div>
          </form>
          {error ? <Alert tone="error">{error}</Alert> : null}
          {check ? (
            <div className="flex flex-col gap-3">
              <Alert tone="info">
                <strong>
                  Valid key: {check.plan.name} · {check.days} days.
                </strong>{" "}
                {check.needsChoice ? "This is a different plan from your current one." : `It runs ${formatDate(check.options[0]!.startsAt, tz)} – ${formatDate(check.options[0]!.endsAt, tz)}.`}
              </Alert>
              {check.needsChoice ? (
                <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
                  <legend className="pb-2 text-sm font-semibold">When should {check.plan.name} start?</legend>
                  {check.options.map((o) => (
                    <label key={o.choice} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3.5 ${choice === o.choice ? "border-2 border-indigo" : "border border-line"}`}>
                      <input type="radio" name="when" checked={choice === o.choice} onChange={() => setChoice(o.choice!)} className="mt-1 size-[18px] accent-indigo" />
                      <span className="flex flex-col gap-1">
                        <span className="font-semibold">{o.choice === "now" ? "Switch now" : "Start after my current plan"}</span>
                        <span className="text-[13px] leading-relaxed text-muted">
                          {o.choice === "now"
                            ? `${o.convertedDays > 0 ? `Your remaining ${current?.name} days are converted by price into ${o.convertedDays} extra ${check.plan.name} days. ` : current?.source === "TRIAL" ? "Your free trial ends now. " : ""}${check.plan.name} until ${formatDate(o.endsAt, tz)}.`
                            : `${current?.name} continues until ${formatDate(o.startsAt, tz)}, then ${check.plan.name} runs until ${formatDate(o.endsAt, tz)}.`}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}
              <Button onClick={redeem} busy={busy} className="h-[50px]">
                Redeem key
              </Button>
              <p className="m-0 text-xs text-muted">A key works once.</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4">
            <span className="text-sm font-semibold">Need a key? Buy on setutechnology.com</span>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(130px,1fr))] gap-2.5">
              {PRICES.map((p) => (
                <div key={p.name} className="flex flex-col gap-1 rounded-xl border border-line p-3">
                  <span className="text-sm font-semibold">{p.name}</span>
                  <span className="text-xs text-muted">{p.branches}</span>
                  <span className="text-[15px] font-bold text-indigo">{p.inr}</span>
                  <span className="text-xs text-muted">{p.usd}</span>
                </div>
              ))}
            </div>
            <a href={BUY_URL} target="_blank" rel="noreferrer" className="text-sm font-semibold text-indigo">
              Buy a key ↗
            </a>
            <span className="text-xs text-muted">Prices include GST. More than 100 branches: contact sales.</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
