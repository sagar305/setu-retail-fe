// Client for the Setu Retail API.
// - Access token lives in memory only; the refresh token is an http-only cookie
//   the browser sends to /auth/* (we never see it).
// - A 401 triggers one shared refresh, then the request is retried once.
// Types come from the API's OpenAPI spec (npm run api:types).
import type { components } from "./api-types";

export type Schemas = components["schemas"];
export type Me = Schemas["Me"];
export type Session = Schemas["Session"];
export type Branch = Schemas["Branch"];
export type Staff = Schemas["Staff"];
export type Plan = Schemas["Plan"];
export type Role = Me["user"]["role"];

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** Field → first message, from a 400 validation_error. */
  get fieldErrors(): Record<string, string> {
    const fe = (this.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors ?? {};
    return Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v[0] ?? ""]));
  }
}

let accessToken: string | null = null;
let onSessionLost: (() => void) | null = null;
let refreshing: Promise<Session | null> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function onSignedOut(handler: () => void) {
  onSessionLost = handler;
}

/** Tests only: forget the session between tests so nothing carries over. */
export function resetApiState() {
  accessToken = null;
  onSessionLost = null;
  refreshing = null;
}

async function raw<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "include",
    signal,
  });
  if (res.status === 204) return undefined as T;
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

/** One refresh at a time; null when there's no valid session. */
export function refreshSession(): Promise<Session | null> {
  refreshing ??= raw<Session>("POST", "/auth/refresh")
    .then((s) => {
      setAccessToken(s.accessToken);
      return s;
    })
    .catch((err: unknown) => {
      setAccessToken(null);
      if (err instanceof ApiError && (err.status === 401 || err.status === 403 || err.status === 402)) return null;
      throw err;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function api<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  try {
    return await raw<T>(method, path, body, signal);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || path.startsWith("/auth/")) throw err;
    const session = await refreshSession();
    if (!session) {
      onSessionLost?.();
      throw err;
    }
    return raw<T>(method, path, body, signal);
  }
}

export const apiGet = <T>(path: string, signal?: AbortSignal) => api<T>("GET", path, undefined, signal);
export const apiPost = <T>(path: string, body?: unknown) => api<T>("POST", path, body ?? {});
export const apiPatch = <T>(path: string, body: unknown) => api<T>("PATCH", path, body);

// ── Endpoints ──
export const authApi = {
  login: (login: string, password: string) => raw<Session>("POST", "/auth/login", { login, password }),
  logout: () => raw<void>("POST", "/auth/logout"),
  signup: (body: SignupInput) => raw<{ status: string; email: string }>("POST", "/auth/signup", body),
  verifyEmail: (token: string) => raw<{ verified: true }>("POST", "/auth/verify-email", { token }),
  resendVerification: (email: string) => raw<{ status: string }>("POST", "/auth/resend-verification", { email }),
  forgotPassword: (email: string) => raw<{ status: string }>("POST", "/auth/forgot-password", { email }),
  resetPassword: (token: string, password: string) => raw<{ reset: true }>("POST", "/auth/reset-password", { token, password }),
  inviteInfo: (token: string) =>
    raw<{ name: string; email: string; username: string; role: Role; businessName: string }>("GET", `/auth/invite/${encodeURIComponent(token)}`),
  acceptInvite: (token: string, password: string) => raw<{ accepted: true; username: string }>("POST", "/auth/accept-invite", { token, password }),
};

export type SignupInput = {
  businessName: string;
  ownerName: string;
  email: string;
  username: string;
  password: string;
  phone: string;
  taxNumber?: string;
};

export type Health = { status: "ok"; service: string; version: string; time: string };
export const getHealth = (signal?: AbortSignal) => apiGet<Health>("/health", signal);

// ── Phase 2a models ──
export type Settings = Schemas["Settings"];
export type PaymentMethod = Schemas["PaymentMethod"];
export type Counter = Schemas["Counter"];
export type Category = Schemas["Category"];
export type Product = Schemas["Product"];
export type Customer = Schemas["Customer"];
export type Order = Schemas["Order"];
export type OrderSummary = Schemas["OrderSummary"];
export type HeldCart = Schemas["HeldCart"];
export type OrderBody = Schemas["OrderBody"];
export const apiPut = <T>(path: string, body: unknown) => api<T>("PUT", path, body);
export const apiDelete = (path: string) => api<void>("DELETE", path);

// ── Phase 2b ──
export type Batch = Schemas["Batch"];
export type Dashboard = Schemas["Dashboard"];
export type SalesReport = Schemas["SalesReport"];
export type GstReport = Schemas["GstReport"];
export type StockReport = Schemas["StockReport"];
export type StaffReport = Schemas["StaffReport"];
export type StockLog = Schemas["StockLog"];
export type ImportResult = Schemas["ImportResult"];
export type ProductImportRow = Schemas["ProductImportRow"];
export type CustomerImportRow = Schemas["CustomerImportRow"];

// ── Phase 3: offline ──
export type OfflinePack = Schemas["OfflinePack"];
export type SyncOrder = Schemas["SyncOrder"];
export type SyncCustomer = Schemas["SyncCustomer"];
export type SyncResults = Schemas["SyncResults"];

/** Calls that authenticate with this counter's device key instead of a user session. */
export async function deviceRequest<T>(method: "GET" | "POST", path: string, deviceKey: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { "X-Device-Key": deviceKey };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${API_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`, err?.details);
  }
  return data as T;
}

// ── Phase 4a: connected money tools ──
export type Supplier = Schemas["Supplier"];
export type Expense = Schemas["Expense"];
export type Statement = Schemas["Statement"];
export type CashBook = Schemas["CashBook"];
export type Purchase = Schemas["Purchase"];
export type PurchaseSummary = Schemas["PurchaseSummary"];
export type PurchaseBody = Schemas["PurchaseBody"];
export type SyncMoneyOp = Schemas["SyncMoneyOp"];

// ── Phase 4b ──
export type ReceiptTemplate = Schemas["ReceiptTemplate"];
export type CustomerAging = Schemas["CustomerAging"];
export type SupplierAging = Schemas["SupplierAging"];
export type ProfitReport = Schemas["ProfitReport"];
export type StockRegister = Schemas["StockRegister"];

// ── Phase 5 ──
export type Transfer = Schemas["Transfer"];
export type BranchComparison = Schemas["BranchComparison"];
export type StockAcross = Schemas["StockAcross"];
export type TransferReport = Schemas["TransferReport"];
export type AuditEntry = Schemas["AuditEntry"];
