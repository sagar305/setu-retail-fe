// Client for the Setu team (super-admin) API. Separate from the shop client:
// its own access token (memory only) and refresh cookie (/admin/auth), so a
// shop session and an admin session never mix.
import { API_URL, ApiError, type Schemas } from "../lib/api";

export type Admin = Schemas["SuperAdmin"];
export type AdminSession = Schemas["AdminSession"];
export type AdminLoginStep = Schemas["AdminLoginStep"];
export type AdminDashboard = Schemas["AdminDashboard"];
export type AccountRow = Schemas["AdminAccountRow"];
export type AccountDetail = Schemas["AdminAccountDetail"];
export type IssuedKey = Schemas["IssuedKey"];
export type Redemption = Schemas["AdminRedemption"];
export type Activity = Schemas["AdminActivity"];
export type AccountStatus = AccountRow["status"];

let token: string | null = null;
let refreshing: Promise<AdminSession | null> | null = null;
let onLost: (() => void) | null = null;

export const setAdminToken = (t: string | null) => {
  token = t;
};
export const onAdminSignedOut = (fn: (() => void) | null) => {
  onLost = fn;
};
/** Tests only. */
export function resetAdminApi() {
  token = null;
  refreshing = null;
  onLost = null;
}

async function raw<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: "include" });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

export function refreshAdmin(): Promise<AdminSession | null> {
  refreshing ??= raw<AdminSession>("POST", "/admin/auth/refresh")
    .then((s) => {
      token = s.accessToken;
      return s;
    })
    .catch((err: unknown) => {
      token = null;
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return null;
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  try {
    return await raw<T>(method, path, body);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;
    if (!(await refreshAdmin())) {
      onLost?.();
      throw err;
    }
    return raw<T>(method, path, body);
  }
}

const get = <T>(path: string) => call<T>("GET", path);
const post = <T>(path: string, body: unknown = {}) => call<T>("POST", path, body);
const id = (s: string) => encodeURIComponent(s);

export const adminAuth = {
  login: (email: string, password: string) => raw<AdminLoginStep>("POST", "/admin/auth/login", { email, password }),
  verify: (t: string, code: string) => raw<AdminSession>("POST", "/admin/auth/verify", { token: t, code }),
  setup: (t: string, code: string) => raw<AdminSession>("POST", "/admin/auth/setup-2fa", { token: t, code }),
  logout: () => raw<void>("POST", "/admin/auth/logout"),
  invite: (t: string) => raw<{ email: string; name: string }>("GET", `/admin/auth/invite/${id(t)}`),
  accept: (t: string, password: string) => raw<{ accepted: boolean; email: string }>("POST", "/admin/auth/accept", { token: t, password }),
};

export type IssueKeyInput = {
  accountId: string;
  days: number;
  maxBranches: number;
  maxStaff: number | null;
  maxProducts: number | null;
  maxCustomers: number | null;
  maxOrdersPerMonth: number | null;
  note: string;
};

export const adminApi = {
  dashboard: () => get<AdminDashboard>("/admin/dashboard"),
  accounts: (q: { q?: string; status?: string; expiring?: number; offset?: number }) => {
    const p = new URLSearchParams();
    if (q.q) p.set("q", q.q);
    if (q.status) p.set("status", q.status);
    if (q.expiring) p.set("expiring", String(q.expiring));
    if (q.offset) p.set("offset", String(q.offset));
    return get<{ accounts: AccountRow[]; total: number }>(`/admin/accounts?${p}`);
  },
  account: (accountId: string) => get<AccountDetail>(`/admin/accounts/${id(accountId)}`),
  lock: (accountId: string, reason: string) => post<{ locked: boolean }>(`/admin/accounts/${id(accountId)}/lock`, { reason }),
  unlock: (accountId: string, note: string) => post<{ locked: boolean }>(`/admin/accounts/${id(accountId)}/unlock`, { note }),
  addDays: (accountId: string, days: number, reason: string) => post<{ planCode: string; startsAt: string; endsAt: string }>(`/admin/accounts/${id(accountId)}/add-days`, { days, reason }),
  resendVerification: (accountId: string) => post<{ sent: boolean; to: string }>(`/admin/accounts/${id(accountId)}/resend-verification`),
  sendReset: (accountId: string) => post<{ sent: boolean; to: string }>(`/admin/accounts/${id(accountId)}/send-reset`),
  remind: (accountId: string) => post<{ sent: boolean }>(`/admin/accounts/${id(accountId)}/remind`),
  remindAll: (withinDays: number) => post<{ sent: number; skipped: number }>("/admin/reminders", { withinDays }),
  issueKey: (body: IssueKeyInput) => post<{ id: string; key: string; emailedTo: string | null; redeemUrl: string }>("/admin/keys", body),
  revokeKey: (keyId: string) => post<{ revoked: boolean }>(`/admin/keys/${id(keyId)}/revoke`),
  keys: () => get<{ keys: IssuedKey[] }>("/admin/keys"),
  redemptions: (before?: string) => get<{ redemptions: Redemption[]; next: string | null }>(`/admin/redemptions${before ? `?before=${id(before)}` : ""}`),
  activity: (q: { action?: string; adminId?: string; accountId?: string; before?: string }) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
    return get<{ entries: Activity[]; next: string | null }>(`/admin/activity?${p}`);
  },
  admins: () => get<{ admins: Admin[] }>("/admin/admins"),
  invite: (email: string, name: string) => post<{ admin: Admin }>("/admin/admins", { email, name }),
  resetAdmin: (adminId: string) => post<{ admin: Admin }>(`/admin/admins/${id(adminId)}/reset`),
  disableAdmin: (adminId: string) => post<{ admin: Admin }>(`/admin/admins/${id(adminId)}/disable`),
  enableAdmin: (adminId: string) => post<{ admin: Admin }>(`/admin/admins/${id(adminId)}/enable`),
};
