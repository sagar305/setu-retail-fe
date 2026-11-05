import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { SyncProvider } from "./offline/SyncProvider";

// The Setu team's area is its own app: shops never download it, and the shop
// sign-in, offline mode and sync don't run there.
const SuperAdminApp = lazy(() => import("./admin/SuperAdminApp"));

export function Root() {
  return (
    <Routes>
      <Route
        path="/super-admin/*"
        element={
          <Suspense fallback={<p className="p-6 text-muted">Loading…</p>}>
            <SuperAdminApp />
          </Suspense>
        }
      />
      <Route
        path="*"
        element={
          <AuthProvider>
            <SyncProvider>
              <App />
            </SyncProvider>
          </AuthProvider>
        }
      />
    </Routes>
  );
}
