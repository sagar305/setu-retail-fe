import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Alert } from "../../components/ui";
import { authApi } from "../../lib/api";
import { errorMessage } from "../../lib/format";
import { AuthLayout } from "./AuthLayout";
import { NewPasswordForm } from "./NewPasswordForm";

type Invite = Awaited<ReturnType<typeof authApi.inviteInfo>>;

export function AcceptInvite() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const navigate = useNavigate();
  const [invite, setInvite] = useState<Invite | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi.inviteInfo(token).then(setInvite, (err: unknown) => setError(errorMessage(err)));
  }, [token]);

  return (
    <AuthLayout title={invite ? `Join ${invite.businessName}` : "Set your password"} subtitle={invite ? `You've been added as ${invite.role === "MANAGER" ? "a manager" : "a cashier"}.` : undefined}>
      {error ? (
        <>
          <Alert tone="error">{error}</Alert>
          <p className="m-0 text-sm text-muted">Ask the shop owner or your manager to send the invite again.</p>
        </>
      ) : null}
      {invite ? (
        <>
          <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-cream px-4 py-3 text-sm">
            <dt className="text-muted">Name</dt>
            <dd className="m-0 font-medium">{invite.name}</dd>
            <dt className="text-muted">Username</dt>
            <dd className="m-0 font-medium">{invite.username}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="m-0 font-medium break-all">{invite.email}</dd>
          </dl>
          <NewPasswordForm
            submitLabel="Set password"
            onSubmit={async (pw) => {
              const res = await authApi.acceptInvite(token, pw);
              navigate(`/sign-in?login=${encodeURIComponent(res.username)}`, { replace: true });
            }}
          />
        </>
      ) : null}
      {!invite && !error ? <p className="m-0 text-muted">Loading…</p> : null}
      <Link to="/sign-in" className="text-sm font-semibold text-indigo">
        Go to sign in
      </Link>
    </AuthLayout>
  );
}
