import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { apiGet, authApi, onSignedOut, refreshSession, setAccessToken, type Me, type Role } from "../lib/api";
import { kvDelete, kvGet, kvSet } from "../offline/db";
import { setCacheOwner } from "../lib/cache";
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
/**
 * The last signed-in person on this device, so the app opens at once instead
 * of waiting for the cloud (Phase 9a). Only the profile is kept, never a token;
 * the cloud still checks the session in the background. Lasts one shift.
 */
const LAST_ME_KEY = "lastMe";
type LastMe = { me: Me; until: string };

async function rememberMe(me: Me, fresh: boolean) {
  const prev = await kvGet<LastMe>(LAST_ME_KEY).catch(() => undefined);
  const until = !fresh && prev && prev.me.user.id === me.user.id ? prev.until : new Date(Date.now() + SHIFT_MS).toISOString();
  await setCacheOwner(me.user.id);
  await kvSet(LAST_ME_KEY, { me, until } satisfies LastMe).catch(() => {});
}
async function forgetMe() {
  await kvDelete(LAST_ME_KEY).catch(() => {});
}

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

  const restore = useCallback(async () => {
    // Open at once with the last person on this device, if their shift is still on.
    const last = await kvGet<LastMe>(LAST_ME_KEY).catch(() => undefined);
    const quick = last && new Date(last.until) > new Date() ? last.me : null;
    if (quick) {
      await setCacheOwner(quick.user.id);
      setState({ status: "signedIn", me: quick });
    } else {
      setState({ status: "loading" });
    }
    return refreshSession()
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
        if (s) await rememberMe(s.me, false);
        else await forgetMe();
        setState(s ? { status: "signedIn", me: s.me } : { status: "signedOut" });
      })
      .catch(async () => {
        // No internet, but this person's shift is on: keep going with what this device has.
        if (quick) return;
        // No internet. Continue an offline shift, or offer PIN sign-in if this counter can bill offline.
        const saved = await kvGet<OfflineSession>(OFFLINE_KEY).catch(() => undefined);
        if (saved && new Date(saved.expiresAt) > new Date()) return setState({ status: "offline", session: saved });
        const packs = await allPacks().catch(() => []);
        setState(packs.some((p) => p.users.length) ? { status: "offlineSignIn" } : { status: "unreachable" });
      });
  }, []);

  useEffect(() => {
    onSignedOut(() => {
      void forgetMe();
      setState({ status: "signedOut" });
    });
    if (started.current) return;
    started.current = true;
    void restore();
  }, [restore]);

  const signedIn = state.status === "signedIn";
  useEffect(() => {
    if (!signedIn) return;
    const id = window.setInterval(() => {
      refreshSession()
        .then(async (s) => {
          if (s) await rememberMe(s.me, false);
          else await forgetMe();
          setState(s ? { status: "signedIn", me: s.me } : { status: "signedOut" });
        })
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
        await rememberMe(s.me, true);
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
          await forgetMe();
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
