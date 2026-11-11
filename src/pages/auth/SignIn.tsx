import { useState, type FormEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { Alert, Button, Field } from "../../components/ui";
import { ApiError, authApi, lastRefreshProblem } from "../../lib/api";
import { clearDemoDevice, DEMO_LOGIN, DEMO_MODE, PRODUCTION_APP_URL } from "../../lib/demo";
import { errorMessage } from "../../lib/format";
import { AuthLayout } from "./AuthLayout";

export function SignIn() {
  const { login } = useAuth();
  const location = useLocation();
  const prefill = new URLSearchParams(location.search).get("login") ?? "";
  const [form, setForm] = useState({ login: prefill, password: "" });
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      // The demo is wiped every few hours: start from a clean device copy.
      if (DEMO_MODE) await clearDemoDevice();
      await login(form.login, form.password);
      // PublicOnly sends the now signed-in user on to where they were going.
    } catch (err) {
      setError(err as Error);
    } finally {
      setBusy(false);
    }
  }

  const code = error instanceof ApiError ? error.code : null;

  const problem = lastRefreshProblem();
  return (
    <AuthLayout title="Sign in" subtitle="Use your email or username.">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {problem && !error ? <Alert tone="warn">{problem}</Alert> : null}
        {DEMO_LOGIN ? (
          <div className="flex flex-col gap-3 rounded-xl border border-[#F2C98E] bg-[#FDF1DE] px-4 py-3 text-sm">
            <div>
              <p className="m-0 font-semibold">This is a demo shop — anyone can sign in</p>
              <dl className="m-0 mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-muted">
                <dt>Login</dt>
                <dd className="m-0 font-medium break-all text-ink">{DEMO_LOGIN.login}</dd>
                <dt>Password</dt>
                <dd className="m-0 font-medium break-all text-ink">{DEMO_LOGIN.password}</dd>
              </dl>
              <p className="m-0 mt-1.5 text-[13px] text-muted">The sample data is restored every few hours, so changes you make here aren't kept.</p>
            </div>
            <Button type="button" variant="secondary" onClick={() => setForm({ login: DEMO_LOGIN!.login, password: DEMO_LOGIN!.password })}>
              Use demo login
            </Button>
          </div>
        ) : null}
        {error ? (
          <Alert tone="error">
            {errorMessage(error)}
            {code === "email_not_verified" && form.login.includes("@") ? (
              <>
                {" "}
                {resent ? (
                  "We've sent the link again."
                ) : (
                  <button
                    type="button"
                    className="font-semibold underline"
                    onClick={() => authApi.resendVerification(form.login).then(() => setResent(true))}
                  >
                    Send the link again
                  </button>
                )}
              </>
            ) : null}
          </Alert>
        ) : null}
        <Field label="Email or username" name="login" autoComplete="username" required value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        <div className="-mt-1 text-right">
          <Link to="/forgot-password" className="text-sm font-medium text-indigo">
            Forgot password?
          </Link>
        </div>
        <Button type="submit" busy={busy} disabled={!form.login || !form.password} className="h-[50px] text-base">
          Sign in
        </Button>
      </form>
      <div className="flex items-center gap-3 text-[13px] text-muted">
        <span className="h-px flex-1 bg-line" />
        New shop?
        <span className="h-px flex-1 bg-line" />
      </div>
      {DEMO_MODE ? (
        <a href={`${PRODUCTION_APP_URL}/sign-up`} className="flex h-[50px] items-center justify-center rounded-[10px] bg-saffron text-base font-semibold text-ink no-underline">
          Create account — 3 months free on Basic
        </a>
      ) : (
        <Link to="/sign-up" className="flex h-[50px] items-center justify-center rounded-[10px] bg-saffron text-base font-semibold text-ink no-underline">
          Create account — 3 months free on Basic
        </Link>
      )}
      <p className="m-0 text-[13px] leading-relaxed text-muted">The trial starts once you verify your email. One trial per email. Staff: use the invite email from your shop owner.</p>
    </AuthLayout>
  );
}
