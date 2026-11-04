import type { ReactNode } from "react";

/** Indigo brand panel + form, as in the approved sign-in prototype. Stacks on phones. */
export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-wrap">
      <div className="flex flex-[1_1_420px] flex-col justify-between gap-8 bg-indigo px-6 py-8 text-white md:px-12 md:py-14">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[10px] bg-saffron text-xl font-bold text-ink" aria-hidden="true">
            S
          </div>
          <span className="text-lg font-semibold">Setu Retail</span>
        </div>
        <div className="hidden max-w-[460px] flex-col gap-5 md:flex">
          <p className="m-0 text-4xl leading-tight font-semibold">Your shop's billing, stock and books — on every counter, in every branch.</p>
          <p className="m-0 leading-relaxed text-[#D9DCEE]">Bills keep going when the internet drops and sync when it's back.</p>
        </div>
        <span className="hidden text-[13px] text-[#D9DCEE] md:block">setutechnology.com</span>
      </div>
      <div className="flex flex-[999_1_480px] items-center justify-center px-5 py-10">
        <div className="flex w-full max-w-[420px] flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="m-0 text-[28px] font-semibold">{title}</h1>
            {subtitle ? <p className="m-0 text-muted">{subtitle}</p> : null}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
