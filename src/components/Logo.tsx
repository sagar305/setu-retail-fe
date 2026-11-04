export function Logo({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-9 items-center justify-center rounded-[9px] bg-saffron font-bold text-ink" aria-hidden="true">
        S
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-[15px] font-semibold">Setu Retail</span>
        {subtitle ? <span className="text-xs opacity-80">{subtitle}</span> : null}
      </div>
    </div>
  );
}
