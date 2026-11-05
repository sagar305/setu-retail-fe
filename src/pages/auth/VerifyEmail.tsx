import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui";
import { authApi } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { AuthLayout } from "./AuthLayout";

export function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState<{ status: "working" } | { status: "done" } | { status: "error"; message: string }>({ status: "working" });
  const sent = useRef(false);

  useEffect(() => {
    // The link works once; don't let StrictMode's double effect spend it twice.
    if (sent.current) return;
    sent.current = true;
    authApi
      .verifyEmail(token)
      .then(() => setState({ status: "done" }))
      .catch((err: unknown) => setState({ status: "error", message: errorMessage(err) }));
  }, [token]);

  return (
    <AuthLayout title="Verify email">
      {state.status === "working" ? <p className="m-0 text-muted">Verifying…</p> : null}
      {state.status === "done" ? (
        <>
          <Alert tone="ok">Your email is verified and your 3-month Basic trial has started.</Alert>
          <Link to="/sign-in" className="flex h-[50px] items-center justify-center rounded-[10px] bg-indigo font-semibold text-white no-underline">
            Sign in
          </Link>
        </>
      ) : null}
      {state.status === "error" ? (
        <>
          <Alert tone="error">{state.message}</Alert>
          <Link to="/sign-in" className="text-sm font-semibold text-indigo">
            Go to sign in to get a new link
          </Link>
        </>
      ) : null}
    </AuthLayout>
  );
}
