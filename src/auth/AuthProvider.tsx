import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiGet, authApi, onSignedOut, refreshSession, setAccessToken, type Me, type Role } from "../lib/api";
import { kvDelete, kvGet, kvSet } from "../offline/db";
import { allPacks } from "../offline/pack";
import type { BranchLite } from "./sessionInfo";

/** Signed in on this counter with a PIN while there was no internet. Lasts one shift. */
export type OfflineSession = {
  userId: string;
  name: string;
  role: Role;
  branch: BranchLite;
  accountName: string;
  timezone: string;
  startedAt: string;
  expiresAt: string;
};

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  /** The API couldn't be reached and this device can't bill offline. */
  | { status: "unreachable" }
  /** No internet, but this counter can sign someone in with their PIN. */
  | { status: "offlineSignIn" }
  | { status: "offline"; session: OfflineSession }
  | { status: "signedIn"; me: Me };

const OFFLINE_KEY = "offlineSession";
const SHIFT_MS = 12 * 3600_000;

type AuthApi = {
  state: AuthState;
  login: (login: string, password: string) => Promise<Me>;
  startOffline: (s: Omit<OfflineSession, "startedAt" | "expiresAt">) => Promise<void>;
  logout: () => Promise<void>;
  reloadMe: () => Promise<Me>;
  retry: () => void;
  /** Internet is back during a PIN shift: continue online only as the same person; anyone else signs in with a password. */
  leaveOffline: () => Promise<void>;
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
      .then(async (s) => {
        // Online again: an offline PIN shift is over. Someone else's saved
        // session on this device doesn't carry over to the PIN user.
        const shift = await kvGet<OfflineSession>(OFFLINE_KEY).catch(() => undefined);
        await kvDelete(OFFLINE_KEY).catch(() => {});
        if (s && shift && shift.userId !== s.me.user.id) {
          await authApi.logout().catch(() => {});
          setAccessToken(null);
          return setState({ status: "signedOut" });
        }
        setState(s ? { status: "signedIn", me: s.me } : { status: "signedOut" });
      })
      .catch(async () => {
        // No internet. Continue an offline shift, or offer PIN sign-in if this counter can bill offline.
        const saved = await kvGet<OfflineSession>(OFFLINE_KEY).catch(() => undefined);
        if (saved && new Date(saved.expiresAt) > new Date()) return setState({ status: "offline", session: saved });
        const packs = await allPacks().catch(() => []);
        setState(packs.some((p) => p.users.length) ? { status: "offlineSignIn" } : { status: "unreachable" });
      });
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
      startOffline: async (s) => {
        const now = new Date();
        const session: OfflineSession = { ...s, startedAt: now.toISOString(), expiresAt: new Date(now.getTime() + SHIFT_MS).toISOString() };
        await kvSet(OFFLINE_KEY, session);
        setState({ status: "offline", session });
      },
      logout: async () => {
        await kvDelete(OFFLINE_KEY).catch(() => {});
        if (state.status === "offline") {
          // Back to PIN sign-in while still offline; sign-in page when online.
          return restore();
        }
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
      leaveOffline: async () => {
        if (state.status !== "offline") return restore();
        const pinUser = state.session.userId;
        const s = await refreshSession().catch(() => undefined);
        if (s === undefined) return; // still no internet
        await kvDelete(OFFLINE_KEY).catch(() => {});
        if (s && s.me.user.id === pinUser) return setState({ status: "signedIn", me: s.me });
        if (s) await authApi.logout().catch(() => {});
        setAccessToken(null);
        setState({ status: "signedOut" });
      },
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
