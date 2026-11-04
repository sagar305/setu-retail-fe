import { useOnlineStatus } from "../hooks/useOnlineStatus";

export function SyncStatus() {
  const online = useOnlineStatus();
  return (
    <span
      role="status"
      className={
        "inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-[13px] font-semibold " +
        (online ? "border-[#A9D5C2] bg-ok-50 text-ok" : "border-[#E08A1E] bg-saffron-50 text-ink")
      }
    >
      <span className={"size-2 rounded-full " + (online ? "bg-[#1F7A5A]" : "bg-[#B4630A]")} aria-hidden="true" />
      {online ? "Online" : <>Offline<span className="hidden sm:inline"> · bills will sync later</span></>}
    </span>
  );
}
