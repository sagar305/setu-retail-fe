import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Card, Field, PageHeader } from "../components/ui";
import { apiDelete, apiGet, api } from "../lib/api";
import { errorMessage } from "../lib/format";

/** Each person's counter PIN, for signing in on a counter without internet. */
export function PinPage() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [again, setAgain] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ pinSet: boolean }>("/me/pin").then((r) => setPinSet(r.pinSet), () => setPinSet(false));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api("PUT", "/me/pin", { pin, password });
      setPinSet(true);
      setPin("");
      setAgain("");
      setPassword("");
      setNotice("Counter PIN saved. Counters pick it up the next time they're online.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const mismatch = again.length > 0 && again !== pin;
  return (
    <div className="w-full max-w-2xl">
      <PageHeader title="Counter PIN" description="Sign in on a counter with this PIN when there's no internet." />
      <Card className="flex flex-col gap-4">
        <p className="m-0 text-sm text-muted">
          {pinSet === null ? "Checking…" : pinSet ? "You have a counter PIN." : "You haven't set a counter PIN yet."} Pick 4 to 6 digits. Offline you can only bill; everything else needs internet and your password.
        </p>
        {notice ? <Alert tone="ok">{notice}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={pinSet ? "New PIN" : "PIN"} type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
            <Field label="PIN again" type="password" inputMode="numeric" autoComplete="off" maxLength={6} value={again} onChange={(e) => setAgain(e.target.value.replace(/\D/g, ""))} error={mismatch ? "The PINs don't match." : undefined} />
          </div>
          <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} hint="To confirm it's you." />
          <div className="flex flex-wrap gap-3">
            <Button type="submit" busy={busy} disabled={pin.length < 4 || pin !== again || !password}>
              Save PIN
            </Button>
            {pinSet ? (
              <Button
                variant="ghost"
                onClick={async () => {
                  await apiDelete("/me/pin");
                  setPinSet(false);
                  setNotice("Counter PIN removed.");
                }}
              >
                Remove PIN
              </Button>
            ) : null}
          </div>
        </form>
      </Card>
    </div>
  );
}
