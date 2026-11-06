import { useEffect, useRef } from "react";
import { onCacheUpdate } from "../lib/cache";

/**
 * Re-read a screen's data when a fresher copy reaches this device (background
 * refresh, another device's change, a change of ours reaching the cloud).
 * `reload` re-runs the screen's own apiGet calls, which now answer from the
 * device at once; open dialogs and typed text are kept. Phase 9b.
 */
export function useCacheRefresh(prefixes: readonly string[], reload: () => void) {
  const fn = useRef(reload);
  useEffect(() => {
    fn.current = reload;
  }, [reload]);
  const key = prefixes.join("|");
  useEffect(() => {
    let timer: number | undefined;
    const off = onCacheUpdate((path) => {
      if (!key.split("|").some((p) => path.startsWith(p))) return;
      // Several answers often land together: re-read once.
      window.clearTimeout(timer);
      timer = window.setTimeout(() => fn.current(), 150);
    });
    return () => {
      off();
      window.clearTimeout(timer);
    };
  }, [key]);
}
