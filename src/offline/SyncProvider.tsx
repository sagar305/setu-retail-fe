import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { db } from "./db";
import { flushOutbox } from "./outbox";

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
    const [pending, rejected, moneyPending, moneyRejected] = await Promise.all([
      db.outbox.where("status").equals("pending").count(),
      db.outbox.where("status").equals("rejected").count(),
      db.money.where("status").equals("pending").count(),
      db.money.where("status").equals("rejected").count(),
    ]);
    const oldest = (
      await Promise.all([
        db.outbox.where("status").equals("pending").sortBy("createdAt").then((r) => r[0]?.createdAt),
        db.money.where("status").equals("pending").sortBy("createdAt").then((r) => r[0]?.createdAt),
        db.customers.where("status").equals("pending").toArray().then((r) => r.map((c) => c.createdAt).sort()[0]),
      ])
    )
      .filter((x): x is string => Boolean(x))
      .sort()[0];
    setCounts({ pending: pending + moneyPending, rejected: rejected + moneyRejected, oldestPendingAt: oldest ?? null });
    return pending + moneyPending;
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
      setState(r.state === "done" ? "idle" : r.state);
      setMessage(r.message ?? null);
      if (r.state === "done") setLastSyncAt(new Date().toISOString());
    } finally {
      running.current = false;
      await recount();
    }
  }, [recount]);

  useEffect(() => {
    void run();
    const id = window.setInterval(() => void run(), EVERY_MS);
    return () => window.clearInterval(id);
  }, [run, online]);

  const value = useMemo<SyncApi>(() => ({ ...counts, state: !online && counts.pending ? "offline" : state, message, lastSyncAt, kick: () => void run() }), [counts, state, message, lastSyncAt, run, online]);
  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useSync(): SyncApi {
  return useContext(SyncContext);
}
