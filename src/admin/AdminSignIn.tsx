import QRCode from "qrcode";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert, Button, Field } from "../components/ui";
import { errorMessage } from "../lib/format";
import { NewPasswordForm } from "../pages/auth/NewPasswordForm";
import { adminAuth, type AdminLoginStep } from "./api";
import { useAdminAuth } from "./AdminAuth";
import { Logo } from "../components/Logo";

/** Plain, clearly-not-the-shop-app frame for the Setu team's sign-in screens. */
export function AdminAuthFrame({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="flex items-center gap-3 bg-ink px-5 py-3.5 text-white">
        <Logo product="Retail admin" size={32} />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-2xl font-semibold">{title}</h1>
            {subtitle ? <p className="m-0 text-sm text-muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}

function CodeForm({ label, onSubmit, submitLabel }: { label: string; submitLabel: string; onSubmit: (code: string) => Promise<void> }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(code.replace(/\s/g, ""));
    } catch (err) {
      setError(errorMessage(err));
      setCode("");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label={label} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={7} required autoFocus value={code} onChange={(e) => setCode(e.target.value)} hint="The 6-digit code in your authenticator app." />
      <Button type="submit" busy={busy} disabled={code.replace(/\s/g, "").length !== 6}>
        {submitLabel}
      </Button>
    </form>
  );
}

function SetupStep({ step, onDone }: { step: Extract<AdminLoginStep, { step: "setup" }>; onDone: (code: string) => Promise<void> }) {
  const [qr, setQr] = useState<string | null>(null);
  useEffect(() => {
    QRCode.toDataURL(step.otpauthUrl, { margin: 1, width: 200 }).then(setQr, () => setQr(null));
  }, [step.otpauthUrl]);
  return (
    <>
      <ol className="m-0 flex list-decimal flex-col gap-2 pl-5 text-sm">
        <li>Open an authenticator app on your phone (Google Authenticator, Microsoft Authenticator, 1Password…).</li>
        <li>Scan this code, or type the key below.</li>
        <li>Enter the 6-digit code it shows.</li>
      </ol>
      <div className="flex flex-col items-center gap-3 rounded-xl bg-cream p-4">
        {qr ? <img src={qr} alt="QR code to add Setu Retail Admin to your authenticator app" width={200} height={200} className="rounded-lg bg-white" /> : null}
        <code className="text-center text-sm break-all select-all" aria-label="Setup key">
          {step.secret.match(/.{1,4}/g)?.join(" ")}
        </code>
      </div>
      <CodeForm label="Code from the app" submitLabel="Turn on and sign in" onSubmit={onDone} />
    </>
  );
}

export function AdminSignIn() {
  const { signedIn } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<AdminLoginStep | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      setStep(await adminAuth.login(email.trim(), password));
      setPassword("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (step?.step === "setup") {
    return (
      <AdminAuthFrame title="Set up two-step sign-in" subtitle="Admins sign in with a password and a code from their phone.">
        <SetupStep step={step} onDone={async (code) => signedIn(await adminAuth.setup(step.token, code))} />
        <Button variant="ghost" onClick={() => setStep(null)}>
          Start again
        </Button>
      </AdminAuthFrame>
    );
  }
  if (step?.step === "code") {
    return (
      <AdminAuthFrame title="Enter your code" subtitle={`Signing in as ${email.trim()}`}>
        <CodeForm label="Authenticator code" submitLabel="Sign in" onSubmit={async (code) => signedIn(await adminAuth.verify(step.token, code))} />
        <Button variant="ghost" onClick={() => setStep(null)}>
          Use a different email
        </Button>
      </AdminAuthFrame>
    );
  }
  return (
    <AdminAuthFrame title="Setu team sign-in" subtitle="For Setu Technology staff only. Shop owners sign in at the main app.">
      <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label="Email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Field label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <Button type="submit" busy={busy} disabled={!email || !password}>
          Continue
        </Button>
      </form>
      <p className="m-0 text-sm text-muted">Lost your phone or password? Ask another Setu admin to reset your sign-in.</p>
    </AdminAuthFrame>
  );
}

/** From the invite / reset email: set a password, then sign in to link the app. */
export function AdminAccept() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [who, setWho] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    adminAuth.invite(token).then(setWho, (err: unknown) => setError(errorMessage(err)));
  }, [token]);
  return (
    <AdminAuthFrame title={who ? `Welcome, ${who.name}` : "Set your admin password"} subtitle={who ? `Setting the password for ${who.email}. You'll link an authenticator app next.` : undefined}>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {who ? (
        <NewPasswordForm
          submitLabel="Set password"
          onSubmit={async (pw) => {
            await adminAuth.accept(token, pw);
            navigate("/super-admin", { replace: true });
          }}
        />
      ) : null}
      {!who && !error ? <p className="m-0 text-muted">Loading…</p> : null}
      <Link to="/super-admin" className="text-sm font-semibold text-indigo">
        Go to admin sign-in
      </Link>
    </AdminAuthFrame>
  );
}
