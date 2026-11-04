import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { db } from "./db";
import { flushOutbox } from "./outbox";

export type SyncState = "idle" | "syncing" | "offline" | "blocked" | "error";
type SyncApi = { pending: number; rejected: number; state: SyncState; message: string | null; lastSyncAt: string | null; kick: () => void };

const SyncContext = createContext<SyncApi>({ pending: 0, rejected: 0, state: "idle", message: null, lastSyncAt: null, kick: () => {} });

const EVERY_MS = 30_000;

/** Keeps pushing this device's queued bills whenever there's a connection. */
export function SyncProvider({ children }: { children: ReactNode }) {
  const online = useOnlineStatus();
  const [counts, setCounts] = useState({ pending: 0, rejected: 0 });
  const [state, setState] = useState<SyncState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const running = useRef(false);

  const recount = useCallback(async () => {
    const [pending, rejected] = await Promise.all([db.outbox.where("status").equals("pending").count(), db.outbox.where("status").equals("rejected").count()]);
    setCounts({ pending, rejected });
    return pending;
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
