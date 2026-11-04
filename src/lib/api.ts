// Thin fetch wrapper for the Setu Retail API. In Phase 1 the typed client is
// generated from the API's /openapi.json; this stays as the transport.

export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? "http_error", err?.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

export type Health = { status: "ok"; service: string; version: string; time: string };

export const getHealth = (signal?: AbortSignal) => apiGet<Health>("/health", { signal });
