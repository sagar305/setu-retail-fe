// The Setu Technology brand logo (the arch mark and the "Setu." wordmark),
// the same as on setutechnology.com, with the product name under it.

/** The arch mark. Takes the text colour. */
export function LogoMark({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" className={className} aria-hidden="true" focusable="false">
      <path d="M18 98 L18 56 C18 40 28 31 46 31 L74 31 C92 31 102 40 102 56 L102 98" fill="none" stroke="currentColor" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type Props = {
  /** "dark" on indigo/ink backgrounds (cream logo), "light" on cream/white (indigo logo). */
  variant?: "light" | "dark";
  /** The line under "Setu.", like "Technology" on the website. */
  product?: string;
  /** An extra line under the logo, e.g. the shop or branch. */
  subtitle?: string;
  size?: number;
};

export function Logo({ variant = "dark", product = "Retail", subtitle, size = 36 }: Props) {
  const color = variant === "dark" ? "text-cream" : "text-indigo";
  const sub = variant === "dark" ? "text-cream/75" : "text-indigo/80";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="inline-flex items-center gap-2.5" role="img" aria-label={`Setu ${product}`}>
        <LogoMark size={size} className={`shrink-0 ${color}`} />
        <span className="flex flex-col leading-none" aria-hidden="true">
          <span className={`text-[22px] font-bold tracking-tight ${color}`}>
            Setu<span className="text-saffron">.</span>
          </span>
          <span className={`mt-1 text-[10px] font-medium tracking-[0.42em] whitespace-nowrap uppercase ${sub}`}>{product}</span>
        </span>
      </span>
      {subtitle ? <span className={`truncate text-xs ${sub}`} title={subtitle}>{subtitle}</span> : null}
    </div>
  );
}
