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
    receiptTemplateId: null as string | null,
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

export const BRANCH_ID = "00000000-0000-4000-8000-000000000001";
const COUNTER_ID = "33333333-3333-4333-8333-333333333333";
const methods = [
  { id: "44444444-4444-4444-8444-000000000001", name: "Cash", kind: "CASH", active: true, sort: 1 },
  { id: "44444444-4444-4444-8444-000000000002", name: "UPI", kind: "UPI", active: true, sort: 2 },
  { id: "44444444-4444-4444-8444-000000000004", name: "Credit (Udhaar)", kind: "CREDIT", active: true, sort: 4 },
];
export const METHODS = methods;
const product = (id: string, name: string, price: number, gstRateBp: number, stockMilli = 10_000) => ({
  id,
  name,
  categoryId: null,
  sku: "",
  barcode: id.endsWith("1") ? "8901234567890" : "",
  hsn: "1101",
  gstRateBp,
  taxInclusive: true,
  unit: "pcs",
  defaultPrice: price,
  branchPrice: null,
  price,
  costPrice: null,
  trackStock: true,
  stockMilli,
  lowStockMilli: null,
  stockStatus: stockMilli <= 0 ? "out" : "ok",
  archived: false,
  nextExpiry: null as string | null,
});
export const PRODUCTS = [
  product("55555555-5555-4555-8555-000000000001", "Wheat Atta 5 kg", 28500, 500),
  product("55555555-5555-4555-8555-000000000002", "Tea 250 g", 14500, 500),
  product("55555555-5555-4555-8555-000000000003", "Detergent 1 kg", 12000, 1800),
];
export const SETTINGS = {
  business: { name: "Sharma Stores", phone: "9876543210", taxNumber: "29ABCDE1234F1Z5", currency: "INR", timezone: "Asia/Kolkata" },
  taxEnabled: true,
  allowNegativeStock: true,
  cashierMaxDiscountBp: 1000,
  receiptFooter: "Thank you!",
  receiptPaperSize: "80mm",
  batchTracking: false,
  tools: {} as Record<string, boolean>,
  creditDays: 0,
  logoDataUrl: null as string | null,
  upiId: "",
  printUpiQrOnReceipt: false,
};

/** The endpoints the billing screen loads. */
export function posRoutes(over: { products?: unknown[]; settings?: Partial<typeof SETTINGS>; nextInvoiceNumber?: number } = {}): Record<string, Reply> {
  return {
    "GET /settings": [200, { ...SETTINGS, ...over.settings }],
    "GET /payment-methods": [200, { methods }],
    "GET /products": [200, { products: over.products ?? PRODUCTS, total: (over.products ?? PRODUCTS).length }],
    "GET /categories": [200, { categories: [] }],
    "GET /counters": [200, { counters: [] }],
    "POST /counters": [201, { counter: { id: COUNTER_ID, branchId: BRANCH_ID, code: "C1", name: "Counter 1", lastSeenAt: null }, deviceKey: `${COUNTER_ID}.secret` }],
    "GET /held-carts": [200, { carts: [] }],
    "GET /sync/pack": [200, makePack(over)],
  };
}

export const COUNTER = COUNTER_ID;

/** What GET /sync/pack returns for the default shop. */
export function makePack(over: { products?: unknown[]; settings?: Partial<typeof SETTINGS>; users?: unknown[]; customers?: unknown[]; nextInvoiceNumber?: number; expired?: boolean } = {}) {
  return {
    at: "2026-11-04T09:00:00.000Z",
    settings: { ...SETTINGS, ...over.settings },
    account: { id: "22222222-2222-4222-8222-222222222222", name: "Sharma Stores", timezone: "Asia/Kolkata", currency: "INR" },
    branch: { id: BRANCH_ID, code: "B1", name: "Main branch", address: "", phone: "", gstin: null, stateCode: null, receiptTemplateId: null as string | null },
    counter: { id: COUNTER_ID, code: "C1", name: "Counter 1", nextInvoiceNumber: over.nextInvoiceNumber ?? 1 },
    plan: { expired: over.expired ?? false },
    methods,
    categories: [],
    products: over.products ?? PRODUCTS,
    batches: [],
    customers: over.customers ?? [],
    users: over.users ?? [],
    customerBalances: [] as { customerId: string; balance: number }[],
    suppliers: [] as { id: string; name: string; phone: string; balance: number }[],
    expenseCategories: ["Rent", "Salaries", "Electricity", "Other"],
    receiptTemplates: [] as unknown[],
  };
}
