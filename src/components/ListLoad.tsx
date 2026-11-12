import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { listsVersion, loadProgress, onListsLoaded, subscribeLists } from "../lib/listData";

/** A thin line under the header while the lists load after sign-in, with how much is in. */
export function ListLoadBar() {
  useSyncExternalStore(subscribeLists, listsVersion, listsVersion);
  const p = loadProgress();
  if (!p.running) return null;
  const pct = p.total ? Math.min(100, Math.round((p.loaded / p.total) * 100)) : 5;
  const n = (x: number) => x.toLocaleString("en-IN");
  return (
    <div className="relative shrink-0 bg-white" role="progressbar" aria-label="Loading your data" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-valuetext={p.total ? `${n(p.loaded)} of ${n(p.total)} loaded` : "Starting"}>
      <div className="h-1 w-full bg-indigo-50">
        <div className="h-1 bg-saffron transition-[width] duration-300" style={{ width: `${pct}%` }} />
      </div>
      <p className="m-0 px-3 py-0.5 text-right text-[11px] text-muted md:px-6">{p.total ? `Loading your data · ${n(p.loaded)} of ${n(p.total)}` : "Loading your data…"}</p>
    </div>
  );
}

/** "Everything is loaded" message after the sign-in load; goes away by itself. */
export function ListLoadedSnackbar() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => onListsLoaded(setMessage), []);
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(() => setMessage(null), 7000);
    return () => window.clearTimeout(t);
  }, [message]);
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-3 bottom-4 z-50 mx-auto flex max-w-xl items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-lg">
      <span className="flex-1">{message}</span>
      <button type="button" aria-label="Close" onClick={() => setMessage(null)} className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-lg text-white/80 hover:text-white">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
