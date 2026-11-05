import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { adminAuth, onAdminSignedOut, refreshAdmin, setAdminToken, type Admin, type AdminSession } from "./api";

type State = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; admin: Admin };

type Ctx = {
  state: State;
  /** After password + code: keep the session. */
  signedIn: (s: AdminSession) => void;
  logout: () => Promise<void>;
};

const AdminAuthContext = createContext<Ctx | null>(null);
/** Admin access tokens last 10 minutes; renew a little before. */
const RENEW_MS = 8 * 60_000;

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  const started = useRef(false);

  useEffect(() => {
    onAdminSignedOut(() => setState({ status: "signedOut" }));
    if (started.current) return;
    started.current = true;
    refreshAdmin().then(
      (s) => setState(s ? { status: "signedIn", admin: s.admin } : { status: "signedOut" }),
      () => setState({ status: "signedOut" }),
    );
    return () => onAdminSignedOut(null);
  }, []);

  useEffect(() => {
    if (state.status !== "signedIn") return;
    const t = setInterval(() => {
      refreshAdmin().then((s) => !s && setState({ status: "signedOut" }), () => {});
    }, RENEW_MS);
    return () => clearInterval(t);
  }, [state.status]);

  const signedIn = useCallback((s: AdminSession) => {
    setAdminToken(s.accessToken);
    setState({ status: "signedIn", admin: s.admin });
  }, []);

  const logout = useCallback(async () => {
    await adminAuth.logout().catch(() => {});
    setAdminToken(null);
    setState({ status: "signedOut" });
  }, []);

  const value = useMemo(() => ({ state, signedIn, logout }), [state, signedIn, logout]);
  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useAdminAuth(): Ctx {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth outside AdminAuthProvider");
  return ctx;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useAdmin(): Admin {
  const { state } = useAdminAuth();
  if (state.status !== "signedIn") throw new Error("useAdmin while signed out");
  return state.admin;
}
