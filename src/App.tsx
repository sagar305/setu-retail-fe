import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, type SessionPreview } from "./components/AppShell";
import { homePathFor, NAV_ITEMS } from "./lib/nav";
import type { Role } from "./lib/roles";
import { ComingSoon } from "./pages/ComingSoon";
import { NotFound } from "./pages/NotFound";
import { SignIn } from "./pages/SignIn";

// Phase 0 has no auth yet: the shell runs with a preview session and a role
// switcher so each role's navigation can be checked. Phase 1 replaces this
// with the signed-in user from the API.
const PREVIEW: SessionPreview = {
  role: "owner",
  name: "Preview User",
  businessName: "Preview business",
  branch: "Preview branch",
};

export function App() {
  const [role, setRole] = useState<Role>(PREVIEW.role);
  const session = { ...PREVIEW, role };
  const allowed = NAV_ITEMS.filter((item) => item.roles.includes(role));

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sign-in" replace />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route element={<AppShell session={session} onRoleChange={setRole} />}>
        {allowed.map((item) => (
          <Route key={item.path} path={item.path} element={<ComingSoon />} />
        ))}
        {/* A role landing on a screen it can't use goes to its home screen. */}
        {NAV_ITEMS.filter((item) => !item.roles.includes(role)).map((item) => (
          <Route key={item.path} path={item.path} element={<Navigate to={homePathFor(role)} replace />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
