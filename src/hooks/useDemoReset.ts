import { useEffect, useRef, useState } from "react";
import { API_URL } from "../lib/api";
import { DEMO_MODE } from "../lib/demo";

export type DemoResetStatus = { enabled: boolean; intervalHours: number | null; nextResetAt: string | null; secondsUntilReset: number | null; resetting: boolean };

const POLL_MS = 60_000;
/** Once the countdown is out, look again soon so "Resetting…" doesn't linger. */
const SOON_MS = 5_000;

/**
 * The demo's reset schedule, for the countdown banner. Demo builds only: the
 * real app never asks. The countdown follows the server's clock (it reports
 * seconds left), so a device with the wrong time still shows the right number.
 */
export function useDemoReset(): { status: DemoResetStatus | null; secondsLeft: number } {
  const [status, setStatus] = useState<DemoResetStatus | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    if (!DEMO_MODE) return;
    let cancelled = false;
    let timer = 0;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/demo/reset`, { credentials: "omit", cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const next = (await res.json()) as DemoResetStatus;
        if (cancelled) return;
        setStatus(next);
        deadline.current = next.secondsUntilReset === null ? null : Date.now() + next.secondsUntilReset * 1000;
        setSecondsLeft(next.secondsUntilReset ?? 0);
        timer = window.setTimeout(load, next.resetting || (next.secondsUntilReset ?? Infinity) <= 0 ? SOON_MS : POLL_MS);
      } catch {
        // Offline or an older API: keep the last good status.
        if (!cancelled) timer = window.setTimeout(load, POLL_MS);
      }
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      window.clearTimeout(timer);
      void load();
    };
    void load();
    document.addEventListener("visibilitychange", onVisible);
    const tick = window.setInterval(() => {
      if (deadline.current !== null) setSecondsLeft(Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000)));
    }, 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return { status, secondsLeft };
}
