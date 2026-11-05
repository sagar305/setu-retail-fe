import { Navigate, Route, Routes } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AdminAuth";
import { AdminShell } from "./AdminShell";
import { AdminAccept, AdminAuthFrame, AdminSignIn } from "./AdminSignIn";
import { AdminAccountPage } from "./pages/AdminAccount";
import { AdminAccountsPage } from "./pages/AdminAccounts";
import { AdminActivityPage } from "./pages/AdminActivity";
import { AdminDashboardPage } from "./pages/AdminDashboard";
import { AdminKeysPage } from "./pages/AdminKeys";
import { AdminTeamPage } from "./pages/AdminTeam";

function Gate() {
  const { state } = useAdminAuth();
  if (state.status === "loading") {
    return (
      <AdminAuthFrame title="Setu Retail admin">
        <p className="m-0 text-muted">Checking your sign-in…</p>
      </AdminAuthFrame>
    );
  }
  if (state.status === "signedOut") return <AdminSignIn />;
  return (
    <Routes>
      <Route element={<AdminShell />}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="accounts" element={<AdminAccountsPage />} />
        <Route path="accounts/:id" element={<AdminAccountPage />} />
        <Route path="keys" element={<AdminKeysPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="team" element={<AdminTeamPage />} />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Route>
    </Routes>
  );
}

/**
 * The hidden /super-admin area for the Setu team. Not linked from the shop
 * app, loaded only when visited, and with its own sign-in (password +
 * authenticator code); the API is the real gate.
 */
export default function SuperAdminApp() {
  return (
    <AdminAuthProvider>
      <Routes>
        <Route path="accept" element={<AdminAccept />} />
        <Route path="*" element={<Gate />} />
      </Routes>
    </AdminAuthProvider>
  );
}
