import { useState, type FormEvent } from "react";
import { Alert, Button, Field } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { errorMessage } from "../../lib/format";

/** New password + confirm, shared by reset-password and accept-invite. */
export function NewPasswordForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && confirm !== password;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters.");
    if (mismatch) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit(password);
    } catch (err) {
      setError(err instanceof ApiError && err.code === "validation_error" ? (err.fieldErrors.password ?? err.message) : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit} noValidate>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <Field label="New password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} hint="At least 8 characters." />
      <Field label="Type it again" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} error={mismatch ? "The passwords don't match." : undefined} />
      <Button type="submit" busy={busy} disabled={!password || !confirm || mismatch}>
        {submitLabel}
      </Button>
    </form>
  );
}
