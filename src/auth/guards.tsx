import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Alert, Button } from "../components/ui";
import { homePathForMe } from "../lib/nav";
import type { Role } from "../lib/roles";
import { useAuth, useMe } from "./AuthProvider";

function Splash({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-6">{children}</div>;
}

/** Signed-in area. Sends others to sign-in and remembers where they were going. */
export function RequireAuth() {
  const { state, retry } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <Splash>Loading…</Splash>;
  if (state.status === "unreachable") {
    return (
      <Splash>
        <div className="flex max-w-md flex-col gap-3">
          <Alert tone="warn">Can't reach Setu Retail. Check the internet connection.</Alert>
          <Button onClick={retry}>Try again</Button>
        </div>
      </Splash>
    );
  }
  if (state.status === "signedOut") return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

/** Public pages (sign-in etc.) bounce a signed-in user to their home screen. */
export function PublicOnly() {
  const { state } = useAuth();
  const location = useLocation();
  if (state.status === "loading") return <Splash>Loading…</Splash>;
  if (state.status === "signedIn") {
    // After signing in, go back to the page that sent them here.
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from ?? homePathForMe(state.me)} replace />;
  }
  return <Outlet />;
}

/** Role gate, plus: an owner whose plan ended only reaches the plan screen. */
export function Allow({ roles, whenExpired = false }: { roles: readonly Role[]; whenExpired?: boolean }) {
  const me = useMe();
  if (!roles.includes(me.user.role)) return <Navigate to={homePathForMe(me)} replace />;
  if (me.plan.expired && !whenExpired) return <Navigate to="/settings/plan" replace />;
  return <Outlet />;
}

export function HomeRedirect() {
  const { state } = useAuth();
  if (state.status === "loading") return <Splash>Loading…</Splash>;
  if (state.status === "signedIn") return <Navigate to={homePathForMe(state.me)} replace />;
  return <Navigate to="/sign-in" replace />;
}
