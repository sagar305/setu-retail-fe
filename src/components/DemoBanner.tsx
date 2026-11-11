import { History, LoaderCircle } from "lucide-react";
import { useDemoReset } from "../hooks/useDemoReset";
import { formatCountdown, PRODUCTION_APP_URL } from "../lib/demo";

/** Tells a demo visitor how long what they're changing has left. Renders nothing outside the demo. */
export function DemoBanner() {
  const { status, secondsLeft } = useDemoReset();
  if (!status?.enabled) return null;
  const resetting = status.resetting || secondsLeft <= 0;
  const h = status.intervalHours;
  const every = !h ? "" : h === 24 ? " every day" : h % 24 === 0 ? ` every ${h / 24} days` : ` every ${h} hour${h === 1 ? "" : "s"}`;
  return (
    <div
      role="status"
      aria-live="off"
      aria-label={resetting ? "The demo data is being reset now" : `Demo: sample data is restored in ${formatCountdown(secondsLeft)}`}
      className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-[#F2C98E] bg-[#FDF1DE] px-4 py-2 text-[13px] text-ink md:px-6"
    >
      <span className="flex items-center gap-1.5" aria-hidden="true">
        {resetting ? <LoaderCircle size={15} className="animate-spin text-saffron" /> : <History size={15} className="text-saffron" />}
        {resetting ? (
          "Resetting the demo data…"
        ) : (
          <>
            <span>
              <span className="max-sm:hidden">Demo shop · sample data is restored{every}. Resets in </span>
              <span className="sm:hidden">Demo · resets in </span>
              <strong className="tabular-nums">{formatCountdown(secondsLeft)}</strong>
            </span>
          </>
        )}
      </span>
      <a href={`${PRODUCTION_APP_URL}/sign-up`} className="inline-flex min-h-11 items-center font-semibold text-indigo underline sm:min-h-0">
        Start your own shop
      </a>
    </div>
  );
}
