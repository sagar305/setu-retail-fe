import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui";
import { authApi } from "../../lib/api";
import { AuthLayout } from "./AuthLayout";
import { NewPasswordForm } from "./NewPasswordForm";

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [done, setDone] = useState(false);
  return (
    <AuthLayout title="Choose a new password" subtitle="You'll be signed out on every device.">
      {done ? (
        <>
          <Alert tone="ok">Password changed.</Alert>
          <Link to="/sign-in" className="flex h-[50px] items-center justify-center rounded-[10px] bg-indigo font-semibold text-white no-underline">
            Sign in
          </Link>
        </>
      ) : (
        <NewPasswordForm submitLabel="Save password" onSubmit={async (pw) => { await authApi.resetPassword(token, pw); setDone(true); }} />
      )}
    </AuthLayout>
  );
}
