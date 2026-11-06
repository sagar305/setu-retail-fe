import { Link } from "react-router-dom";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSync } from "../offline/SyncProvider";

/** Online/offline and what's waiting on this device; opens "Bills on this counter". */
export function SyncStatus() {
  const online = useOnlineStatus();
  const { pending, rejected, state } = useSync();
  let tone = "border-[#A9D5C2] bg-ok-50 text-ok";
  let dot = "bg-[#1F7A5A]";
  let text: React.ReactNode = "Online";
  if (state === "blocked") {
    tone = "border-[#E08A1E] bg-saffron-50 text-ink";
    dot = "bg-[#B4630A]";
    text = <>Sync paused<span className="hidden sm:inline"> · plan ended · {pending} waiting</span></>;
  } else if (!online) {
    tone = "border-[#E08A1E] bg-saffron-50 text-ink";
    dot = "bg-[#B4630A]";
    text = <>Offline{pending ? ` · ${pending}` : ""}<span className="hidden sm:inline">{pending ? " waiting" : " · changes sync later"}</span></>;
  } else if (state === "syncing") {
    text = `Syncing ${pending}…`;
  } else if (pending) {
    text = `${pending} waiting to sync`;
  }
  if (rejected) {
    tone = "border-[#E7B3A6] bg-[#FBEAE6] text-[#7A2412]";
    dot = "bg-[#A3361F]";
    text = `${rejected} need${rejected === 1 ? "s" : ""} attention`;
  }
  return (
    <Link to="/counter-bills" role="status" className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold no-underline ${tone}`}>
      <span className={`size-2 rounded-full ${dot}`} aria-hidden="true" />
      <span>{text}</span>
    </Link>
  );
}
