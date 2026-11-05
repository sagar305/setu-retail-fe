import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Field } from "../../components/ui";
import { authApi } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { AuthLayout } from "./AuthLayout";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await authApi.forgotPassword(email);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We'll email you a link to choose a new one.">
      {done ? (
        <Alert tone="ok">If {email} has a Setu Retail account, a reset link is on its way. It expires in 1 hour.</Alert>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={submit}>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <Field label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" busy={busy} disabled={!email}>
            Email me a link
          </Button>
        </form>
      )}
      <Link to="/sign-in" className="text-sm font-semibold text-indigo">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
