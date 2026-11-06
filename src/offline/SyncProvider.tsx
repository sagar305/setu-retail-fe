import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { db } from "./db";
import { flushOutbox } from "./outbox";
import { flushChanges, onChangesUpdate } from "../lib/changes";

export type SyncState = "idle" | "syncing" | "offline" | "blocked" | "error";
type SyncApi = {
  pending: number;
  rejected: number;
  /** When the oldest change still waiting on this device was made (null: nothing waiting). */
  oldestPendingAt: string | null;
  state: SyncState;
  message: string | null;
  lastSyncAt: string | null;
  kick: () => void;
};

const SyncContext = createContext<SyncApi>({ pending: 0, rejected: 0, oldestPendingAt: null, state: "idle", message: null, lastSyncAt: null, kick: () => {} });

const EVERY_MS = 30_000;

/** Keeps pushing this device's queued bills whenever there's a connection. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [counts, setCounts] = useState<{ pending: number; rejected: number; oldestPendingAt: string | null }>({ pending: 0, rejected: 0, oldestPendingAt: null });
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const running = useRef(false);

  const recount = useCallback(async () => {
    const [pending, rejected, moneyPending, moneyRejected, changesPending, changesRejected] = await Promise.all([
      db.outbox.where("status").equals("pending").count(),
      db.outbox.where("status").equals("rejected").count(),
      db.money.where("status").equals("pending").count(),
      db.money.where("status").equals("rejected").count(),
      db.changes.where("status").equals("pending").count(),
      db.changes.where("status").equals("rejected").count(),
    ]);
    const oldest = (
      await Promise.all([
        db.outbox.where("status").equals("pending").sortBy("createdAt").then((r) => r[0]?.createdAt),
        db.money.where("status").equals("pending").sortBy("createdAt").then((r) => r[0]?.createdAt),
        db.customers.where("status").equals("pending").toArray().then((r) => r.map((c) => c.createdAt).sort()[0]),
        db.changes.where("status").equals("pending").sortBy("createdAt").then((r) => r[0]?.createdAt),
      ])
    )
      .filter((x): x is string => Boolean(x))
      .sort()[0];
    setCounts({ pending: pending + moneyPending + changesPending, rejected: rejected + moneyRejected + changesRejected, oldestPendingAt: oldest ?? null });
    return pending + moneyPending + changesPending;
  }, []);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const pending = (await recount()) + (await db.customers.where("status").equals("pending").count());
      if (!pending) {
        setState("idle");
        setMessage(null);
        return;
      }
      if (!navigator.onLine) {
        setState("offline");
        return;
      }
      setState("syncing");
      const r = await flushOutbox();
      // Then everything else saved on this device (Phase 9b), as the person signed in.
      const c = r.state === "done" ? await flushChanges() : null;
      const done = r.state === "done" && (!c || c.state === "done");
      setState(done ? "idle" : r.state !== "done" ? r.state : c!.state === "offline" ? "offline" : "error");
      setMessage(r.message ?? (c && c.state === "error" ? "Some changes couldn't be sent yet. Retrying." : null));
      if (done) setLastSyncAt(new Date().toISOString());
    } finally {
      running.current = false;
      await recount();
    }
  }, [recount]);

  useEffect(() => {
    void run();
    const id = window.setInterval(() => void run(), EVERY_MS);
    // A change was just saved: send it now rather than at the next tick.
    const onSaved = () => void run();
    window.addEventListener("setu:changes", onSaved);
    const off = onChangesUpdate(() => void recount());
    return () => {
      window.clearInterval(id);
      window.removeEventListener("setu:changes", onSaved);
      off();
    };
  }, [run, online, recount]);

  const value = useMemo<SyncApi>(() => ({ ...counts, state: !online && counts.pending ? "offline" : state, message, lastSyncAt, kick: () => void run() }), [counts, state, message, lastSyncAt, run, online]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useSync(): SyncApi {
  return useContext(SyncContext);
}
