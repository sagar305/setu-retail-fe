import { Maximize, Minimize } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * Puts the whole app in full screen (handy on a counter or a tablet) and back.
 * Hidden where the browser can't do it (iPhone Safari).
 */
export function FullscreenButton() {
  const supported = typeof document !== "undefined" && Boolean(document.fullscreenEnabled);
  const [on, setOn] = useState(() => supported && Boolean(document.fullscreenElement));

  useEffect(() => {
    if (!supported) return;
    const sync = () => setOn(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, [supported]);

  if (!supported) return null;
  const label = on ? "Exit full screen" : "Full screen";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={() => {
        const done = on ? document.exitFullscreen() : document.documentElement.requestFullscreen();
        // A refusal (e.g. not from a tap) leaves the screen as it was.
        void done?.catch(() => {});
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-[10px] border border-line bg-white text-ink"
    >
      {on ? <Minimize size={18} aria-hidden="true" /> : <Maximize size={18} aria-hidden="true" />}
    </button>
  );
}
