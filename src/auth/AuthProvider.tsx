import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiGet, authApi, onSignedOut, refreshSession, setAccessToken, type Me } from "../lib/api";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  /** The API couldn't be reached while restoring the session (offline sign-in arrives in Phase 3). */
  | { status: "unreachable" }
  | { status: "signedIn"; me: Me };

type AuthApi = {
  state: AuthState;
  login: (login: string, password: string) => Promise<Me>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<Me>;
  retry: () => void;
};

const AuthContext = createContext<AuthApi | null>(null);

/** Access tokens last 15 minutes; renew a little before. */
const RENEW_MS = 12 * 60_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const started = useRef(false);

  const restore = useCallback(() => {
    setState({ status: "loading" });
    refreshSession()
      .then((s) => setState(s ? { status: "signedIn", me: s.me } : { status: "signedOut" }))
      .catch(() => setState({ status: "unreachable" }));
  }, []);

  useEffect(() => {
    onSignedOut(() => setState({ status: "signedOut" }));
    if (started.current) return;
    started.current = true;
    restore();
  }, [restore]);

  const signedIn = state.status === "signedIn";
  useEffect(() => {
    if (!signedIn) return;
    const id = window.setInterval(() => {
      refreshSession()
        .then((s) => setState(s ? { status: "signedIn", me: s.me } : { status: "signedOut" }))
        .catch(() => {
          /* offline: keep the current session until the next try */
        });
    }, RENEW_MS);
    return () => window.clearInterval(id);
  }, [signedIn]);

  const value = useMemo<AuthApi>(
    () => ({
      state,
      login: async (login, password) => {
        const s = await authApi.login(login, password);
        setAccessToken(s.accessToken);
        setState({ status: "signedIn", me: s.me });
        return s.me;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setAccessToken(null);
          setState({ status: "signedOut" });
        }
      },
      reloadMe: async () => {
        const me = await apiGet<Me>("/me");
        setState({ status: "signedIn", me });
        return me;
      },
      retry: restore,
    }),
    [state, restore],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

/** The signed-in user. Only call inside the signed-in part of the app. */
// eslint-disable-next-line react-refresh/only-export-components -- hook lives with its provider
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== "signedIn") throw new Error("useMe outside a signed-in route");
  return state.me;
}
