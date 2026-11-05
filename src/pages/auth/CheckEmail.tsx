import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Button } from "../../components/ui";
import { authApi } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";

export function CheckEmail() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [sent, setSent] = useState(false);
  return (
    <AuthLayout title="Check your email" subtitle={<>We sent a verification link to <strong className="text-ink">{email || "your email"}</strong>.</>}>
      <p className="m-0 leading-relaxed">Open it on this or any device to verify your email. Your 3-month Basic trial starts then. The link expires in 24 hours.</p>
      {sent ? <Alert tone="ok">Sent again. Check spam if it isn't there in a minute.</Alert> : null}
      {email ? (
        <Button variant="secondary" onClick={() => authApi.resendVerification(email).then(() => setSent(true))}>
          Send the link again
        </Button>
      ) : null}
      <Link to="/sign-in" className="text-sm font-semibold text-indigo">
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
