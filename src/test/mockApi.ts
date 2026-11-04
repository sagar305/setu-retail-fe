import { vi } from "vitest";
import type { Me } from "../lib/api";

type Reply = [status: number, body?: unknown];
type Handler = (body: unknown, url: URL) => Reply | Promise<Reply>;

/** Route table for fetch: { "POST /auth/login": (body) => [200, {...}] }. Unknown routes → 404. */
export function mockApi(routes: Record<string, Handler | Reply>) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const method = (init?.method ?? "GET").toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body });
    const route = routes[`${method} ${url.pathname}`];
    const [status, data] = typeof route === "function" ? await route(body, url) : (route ?? [404, { error: { code: "not_found", message: "Not found" } }]);
    return new Response(status === 204 ? null : JSON.stringify(data ?? {}), { status });
  });
  return { calls, spy };
}

const signedOut: Reply = [401, { error: { code: "not_signed_in", message: "Please sign in." } }];
export const NOT_SIGNED_IN = signedOut;

export function makeMe(over: { role?: Me["user"]["role"]; expired?: boolean; trialDaysLeft?: number; review?: boolean; branches?: Partial<Me["branches"][number]>[] } = {}): Me {
  const role = over.role ?? "OWNER";
  const branches = (over.branches ?? [{}]).map((b, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    code: `B${i + 1}`,
    name: i === 0 ? "Main branch" : `Branch ${i + 1}`,
    address: "",
    phone: "",
    gstin: null,
    stateCode: null,
    withinPlan: true,
    createdAt: `2026-0${i + 1}-01T00:00:00.000Z`,
    ...b,
  }));
  return {
    user: { id: "11111111-1111-4111-8111-111111111111", name: role === "OWNER" ? "Anil Sharma" : "Ravi Kumar", email: "a@x.com", username: "anil", role },
    account: { id: "22222222-2222-4222-8222-222222222222", name: "Sharma Stores", currency: "INR", timezone: "Asia/Kolkata", keepActiveReviewPending: over.review ?? false },
    branches,
    plan: over.expired
      ? { expired: true, daysLeft: 0, current: null, queued: [] }
      : {
          expired: false,
          daysLeft: over.trialDaysLeft ?? 80,
          current: {
            code: "basic",
            name: "Basic",
            source: "TRIAL",
            startsAt: "2026-11-04T10:00:00.000Z",
            endsAt: "2027-02-04T10:00:00.000Z",
            limits: { maxBranches: 1, maxStaff: 3, maxProducts: 1000, maxCustomers: 2000, maxOrdersPerMonth: 3000 },
          },
          queued: [],
        },
  };
}

export const session = (me: Me): Reply => [200, { accessToken: "test-token", expiresIn: 900, me }];
