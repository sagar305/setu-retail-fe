import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

type Variant = "primary" | "secondary" | "accent" | "danger" | "ghost";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-indigo text-white hover:bg-indigo-600 disabled:opacity-60",
  secondary: "border border-indigo bg-white text-indigo hover:bg-indigo-50 disabled:opacity-60",
  accent: "bg-saffron text-ink hover:brightness-95 disabled:opacity-60",
  danger: "border border-[#A3361F] bg-white text-[#A3361F] hover:bg-[#FBEAE6] disabled:opacity-60",
  ghost: "text-indigo hover:bg-indigo-50 disabled:opacity-60",
};

export function Button({
  variant = "primary",
  busy,
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; busy?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || busy}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold ${VARIANTS[variant]} ${className}`}
    >
      {busy ? "Please wait…" : children}
    </button>
  );
}

export function Field({
  label,
  error,
  hint,
  className = "",
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...input}
        className={`h-12 rounded-[10px] border bg-white px-3.5 text-base text-ink ${error ? "border-[#A3361F]" : "border-line-strong"}`}
      />
      {error ? (
        <span id={`${id}-err`} className="text-[13px] text-[#A3361F]">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="text-[13px] text-muted">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function SelectField({
  label,
  children,
  ...select
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <select id={id} {...select} className="h-12 rounded-[10px] border border-line-strong bg-white px-3 text-base text-ink">
        {children}
      </select>
    </div>
  );
}

type Tone = "info" | "warn" | "error" | "ok";
const TONES: Record<Tone, string> = {
  info: "bg-indigo-50 text-indigo border-[#C8CCE6]",
  warn: "bg-saffron-50 text-ink border-[#E8B676]",
  error: "bg-[#FBEAE6] text-[#7A2412] border-[#E7B3A6]",
  ok: "bg-ok-50 text-ok border-[#A9D5C2]",
};

export function Alert({ tone = "info", children, role }: { tone?: Tone; children: ReactNode; role?: "alert" | "status" }) {
  return (
    <div role={role ?? (tone === "error" ? "alert" : "status")} className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}>
      {children}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-white p-5 ${className}`}>{children}</section>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end gap-3">
      <div className="mr-auto flex flex-col gap-1">
        <h1 className="m-0 text-2xl font-semibold">{title}</h1>
        {description ? <p className="m-0 text-sm text-muted">{description}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function Badge({ tone = "info", children }: { tone?: Tone | "muted"; children: ReactNode }) {
  const cls = tone === "muted" ? "bg-cream text-[#3D4152]" : TONES[tone];
  return <span className={`inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function UsageBar({ label, used, max }: { label: string; used: number; max: number | null }) {
  const pct = max ? Math.min(100, Math.round((used / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px]">
        <span>{label}</span>
        <span className="text-muted">{max === null ? `${used.toLocaleString("en-IN")} · unlimited` : `${used.toLocaleString("en-IN")} of ${max.toLocaleString("en-IN")}`}</span>
      </div>
      <div className="h-2 overflow-hidden rounded bg-cream" role="progressbar" aria-label={label} aria-valuenow={used} aria-valuemin={0} aria-valuemax={max ?? undefined}>
        <div className="h-2 rounded bg-indigo" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Accessible modal: overlay, Escape closes, focus moves inside. */
export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 sm:items-center sm:p-4" onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={(el) => {
          if (el && !el.contains(document.activeElement)) (el.querySelector<HTMLElement>("input, select, textarea, button") ?? el).focus();
        }}
        tabIndex={-1}
        className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:rounded-2xl ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="m-0 text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex size-11 items-center justify-center rounded-[10px] text-xl text-muted hover:bg-cream">
            ×
          </button>
        </div>
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
