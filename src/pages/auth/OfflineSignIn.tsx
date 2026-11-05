import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthProvider";
import { Alert, Button, Field } from "../../components/ui";
import type { OfflinePack } from "../../lib/api";
import { savedCounterId } from "../../offline/counter";
import { kvGet, kvSet } from "../../offline/db";
import { allPacks } from "../../offline/pack";
import { checkPin, PIN_LOCK_MS, PIN_TRIES } from "../../offline/pin";
import { ROLE_LABEL } from "../../lib/roles";
import { AuthLayout } from "./AuthLayout";

type Person = OfflinePack["users"][number] & { packs: OfflinePack[] };

/** No internet: sign in on this counter with a counter PIN. */
export function OfflineSignIn() {
  const { startOffline, retry } = useAuth();
  const [packs, setPacks] = useState<OfflinePack[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    allPacks().then(setPacks, () => setPacks([]));
  }, []);

  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const p of packs) for (const u of p.users) map.set(u.id, { ...u, packs: [...(map.get(u.id)?.packs ?? []), p] });
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [packs]);
  const person = people.find((p) => p.id === userId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!person) return;
    setError(null);
    const lock = (await kvGet<{ tries: number; until: number }>(`pinLock:${person.id}`)) ?? { tries: 0, until: 0 };
    if (lock.until > Date.now()) return setError(`Too many wrong PINs. Try again in ${Math.ceil((lock.until - Date.now()) / 60_000)} minutes.`);
    setBusy(true);
    try {
      if (!(await checkPin(pin, person.pin))) {
        const tries = lock.tries + 1;
        await kvSet(`pinLock:${person.id}`, tries >= PIN_TRIES ? { tries: 0, until: Date.now() + PIN_LOCK_MS } : { tries, until: 0 });
        setPin("");
        return setError(tries >= PIN_TRIES ? "Too many wrong PINs. Wait 5 minutes." : "Wrong PIN.");
      }
      await kvSet(`pinLock:${person.id}`, { tries: 0, until: 0 });
      // Use the branch this device already bills for, if the person works there.
      const pack = person.packs.find((p) => savedCounterId(p.branch.id) === p.counter.id) ?? person.packs[0]!;
      await startOffline({
        userId: person.id,
        name: person.name,
        role: person.role,
        branch: { id: pack.branch.id, code: pack.branch.code, name: pack.branch.name, stateCode: pack.branch.stateCode, withinPlan: true },
        accountName: pack.account.name,
        timezone: pack.account.timezone,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout title="No internet" subtitle="Sign in on this counter with your counter PIN to keep billing. Bills sync when the internet is back.">
      {people.length === 0 ? <Alert tone="warn">Nobody has set a counter PIN for this counter yet.</Alert> : null}
      {!person ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {people.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setUserId(p.id)} className="flex min-h-14 w-full items-center justify-between rounded-xl border border-line bg-white px-4 text-left hover:border-indigo">
                <span className="font-semibold">{p.name}</span>
                <span className="text-sm text-muted">{ROLE_LABEL[p.role]}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <p className="m-0">
            <strong>{person.name}</strong> · {ROLE_LABEL[person.role]}{" "}
            <button type="button" className="text-sm text-indigo underline" onClick={() => { setUserId(null); setPin(""); setError(null); }}>
              not you?
            </button>
          </p>
          <Field label="Counter PIN" type="password" inputMode="numeric" autoComplete="off" maxLength={6} autoFocus value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
          <Button type="submit" busy={busy} disabled={pin.length < 4} className="h-[50px] text-base">
            Sign in offline
          </Button>
        </form>
      )}
      <Button variant="ghost" onClick={retry}>
        Internet is back? Try again
      </Button>
    </AuthLayout>
  );
}
