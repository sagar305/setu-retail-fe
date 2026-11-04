import { Link } from "react-router-dom";

// Phase 0: layout only. Phase 1 wires it to POST /auth/login.
export function SignIn() {
  return (
    <div className="flex min-h-screen flex-wrap">
      <div className="flex flex-[1_1_420px] flex-col justify-between gap-10 bg-indigo px-12 py-14 text-white">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[10px] bg-saffron text-xl font-bold text-ink" aria-hidden="true">
            S
          </div>
          <span className="text-lg font-semibold">Setu Retail</span>
        </div>
        <div className="flex max-w-[460px] flex-col gap-5">
          <h1 className="m-0 text-4xl leading-tight font-semibold">
            Your shop's billing, stock and books — on every counter, in every branch.
          </h1>
          <p className="m-0 leading-relaxed text-[#D9DCEE]">Bills keep going when the internet drops and sync when it's back.</p>
        </div>
        <span className="text-[13px] text-[#D9DCEE]">setutechnology.com</span>
      </div>
      <div className="flex flex-[999_1_480px] items-center justify-center px-5 py-12">
        <form className="flex w-full max-w-[400px] flex-col gap-5" onSubmit={(e) => e.preventDefault()}>
          <div className="flex flex-col gap-1.5">
            <h2 className="m-0 text-[28px] font-semibold">Sign in</h2>
            <p className="m-0 text-muted">Use your email or username.</p>
          </div>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Email or username
            <input name="login" autoComplete="username" required className="h-12 rounded-[10px] border border-line-strong bg-white px-3.5 text-base" />
          </label>
          <label className="flex flex-col gap-2 text-sm font-medium">
            Password
            <input name="password" type="password" autoComplete="current-password" required className="h-12 rounded-[10px] border border-line-strong bg-white px-3.5 text-base" />
          </label>
          <button type="submit" disabled className="h-[50px] rounded-[10px] bg-indigo font-semibold text-white disabled:opacity-60">
            Sign in (Phase 1)
          </button>
          <p className="m-0 text-[13px] text-muted">
            Sign-in is connected in Phase 1. Meanwhile, <Link to="/dashboard" className="font-semibold text-indigo">preview the app shell</Link>.
          </p>
        </form>
      </div>
    </div>
  );
}
