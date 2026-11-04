import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../../auth/AuthProvider";
import { setAccessToken, type OfflinePack } from "../../lib/api";
import { writePref } from "../../lib/storage";
import { db, kvSet } from "../../offline/db";
import { flushOutbox } from "../../offline/outbox";
import { BRANCH_ID, COUNTER, makeMe, makePack, METHODS, mockApi, posRoutes, PRODUCTS, SETTINGS, session } from "../../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const at = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );

const MEERA = { id: "88888888-8888-4888-8888-000000000001", name: "Meera", phone: "9900011111", email: "", address: "", gstin: null, stateCode: null, notes: "", createdAt: "2026-10-01T00:00:00.000Z" };
const statement = (balance: number) => ({
  customer: MEERA,
  balance,
  open: Math.max(0, balance),
  advance: 0,
  rows: [{ id: "r1", at: "2026-11-01T10:00:00.000Z", type: "bill", ref: "B1-C1-00004", note: "", debit: 59000, credit: 0, balance: 59000, methodName: "", branchId: BRANCH_ID, voidable: false, dueDate: null }],
  openItems: balance > 0 ? [{ id: "r1", type: "bill", ref: "B1-C1-00004", at: "2026-11-01T10:00:00.000Z", dueDate: null, amount: 59000, paid: 59000 - balance, open: balance }] : [],
});

describe("connected tools", () => {
  it("cashiers only get the Customer Ledger; switched-off tools disappear", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), "GET /settings": [200, SETTINGS] });
    at("/tools");
    expect(await screen.findByRole("link", { name: /Customer Ledger/ })).toBeInTheDocument();
    expect(screen.queryByText("Cash Book")).not.toBeInTheDocument();
    expect(screen.queryByText("Expense Tracker")).not.toBeInTheDocument();
  });

  it("the owner switches a tool off in Settings and it leaves the hub", async () => {
    let patched: unknown;
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": [200, SETTINGS],
      "PATCH /settings": (body) => {
        patched = body;
        return [200, { ...SETTINGS, tools: { "cash-book": false } }];
      },
    });
    const user = userEvent.setup();
    at("/settings/tools");
    await user.click(await screen.findByRole("switch", { name: "Cash Book on" }));
    expect(patched).toEqual({ tools: { "cash-book": false } });
    expect(await screen.findByRole("switch", { name: "Cash Book off" })).not.toBeChecked();
    await user.click(screen.getByRole("link", { name: "Tools" }));
    expect(await screen.findByText("Expense Tracker")).toBeInTheDocument();
    expect(screen.queryByText("Cash Book")).not.toBeInTheDocument();
  });

  it("billing hides Udhaar while the Customer Ledger is off", async () => {
    const off = { ...SETTINGS, tools: { "customer-ledger": false } };
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ settings: off }), "GET /sync/pack": [200, makePack({ settings: off })] });
    at("/billing");
    expect(await screen.findByRole("button", { name: "UPI" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Udhaar" })).not.toBeInTheDocument();
  });

  it("a cashier receives an udhaar payment; the oldest dues go first", async () => {
    let paid: { amount: number; methodId: string; branchId: string } | undefined;
    mockApi({
      "POST /auth/refresh": session(makeMe({ role: "CASHIER" })),
      "GET /settings": [200, SETTINGS],
      "GET /payment-methods": [200, { methods: METHODS }],
      [`GET /customers/${MEERA.id}/ledger`]: [200, statement(59000)],
      [`POST /customers/${MEERA.id}/payments`]: (body) => {
        paid = body as typeof paid;
        return [201, statement(19000)];
      },
    });
    const user = userEvent.setup();
    at(`/tools/customer-ledger/${MEERA.id}`);
    expect(await screen.findByRole("heading", { name: "Meera" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Opening balance" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Receive payment" }));
    const dlg = screen.getByRole("dialog", { name: "Payment from Meera" });
    expect(within(dlg).getByLabelText("Amount (₹)")).toHaveValue("590");
    await user.clear(within(dlg).getByLabelText("Amount (₹)"));
    await user.type(within(dlg).getByLabelText("Amount (₹)"), "400");
    await user.click(within(dlg).getByRole("button", { name: "Receive ₹400.00" }));
    expect(await screen.findByText("Received ₹400.00. Still owes ₹190.00.")).toBeInTheDocument();
    expect(paid).toMatchObject({ amount: 40000, methodId: METHODS[0]!.id, branchId: BRANCH_ID });
    // Udhaar isn't offered as a way to pay udhaar.
    expect(METHODS.some((m) => m.kind === "CREDIT")).toBe(true);
  });

  it("a supplier bill shows input GST live and saves what was shown", async () => {
    let saved: { lines: unknown[]; expectedTotal: number; paidAmount: number; dueDate: string | null } | undefined;
    const sup = (id: string, name: string, stateCode: string) => ({ id, name, phone: "", email: "", gstin: null, stateCode, address: "", notes: "", balance: 0, createdAt: "2026-10-01T00:00:00.000Z" });
    mockApi({
      "POST /auth/refresh": session(makeMe({ branches: [{ stateCode: "29" }] })),
      "GET /settings": [200, SETTINGS],
      "GET /payment-methods": [200, { methods: METHODS }],
      "GET /suppliers": [200, { suppliers: [sup("s1", "Bharat Traders", "29"), sup("s2", "Delhi Foods", "07")] }],
      "GET /products": [200, { products: PRODUCTS, total: 3 }],
      "POST /purchases": (body) => {
        saved = body as typeof saved;
        return [409, { error: { code: "stop", message: "Stop here" } }];
      },
    });
    const user = userEvent.setup();
    at("/tools/purchases/new");
    await screen.findByRole("option", { name: "Bharat Traders" });
    await user.selectOptions(screen.getByLabelText("Supplier"), "s1");
    expect(screen.getByText(/CGST \+ SGST/)).toBeInTheDocument();
    await user.type(screen.getByLabelText("Bill number"), "BT/1021");
    await user.type(screen.getByLabelText("Item 1"), "Tea 250 g");
    const qty = screen.getByLabelText("Qty (pcs)");
    await user.clear(qty);
    await user.type(qty, "10");
    await user.type(screen.getByLabelText("Cost / unit (₹)"), "42.50");
    // Tea is a 5% product: its rate fills in.
    expect(screen.getByLabelText("GST")).toHaveValue("500");
    expect(screen.getByText("₹10.62")).toBeInTheDocument(); // CGST
    expect(screen.getByText("₹10.63")).toBeInTheDocument(); // SGST
    expect(screen.getAllByText("₹446.25").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "On credit" }));
    await user.click(screen.getByRole("button", { name: "Save bill · stock in" }));
    expect(await screen.findByText("Stop here")).toBeInTheDocument();
    expect(saved).toMatchObject({ expectedTotal: 44625, paidAmount: 0, lines: [{ productId: PRODUCTS[1]!.id, qtyMilli: 10000, unitCost: 4250, gstRateBp: 500 }] });

    // Another state: IGST instead.
    await user.selectOptions(screen.getByLabelText("Supplier"), "s2");
    expect(screen.getByText(/Delhi \(07\) · IGST/)).toBeInTheDocument();
    expect(screen.getByText("IGST")).toBeInTheDocument();
  });
});

describe("offline payments and expenses", () => {
  it("queues a payment against the pack's balance and syncs it once online", async () => {
    const pack = { ...makePack({ customers: [MEERA] }), customerBalances: [{ customerId: MEERA.id, balance: 59000 }] } as unknown as OfflinePack;
    await db.packs.put({ branchId: BRANCH_ID, pack, fetchedAt: pack.at });
    await kvSet(`deviceKey:${COUNTER}`, `${COUNTER}.secret`);
    writePref(`setu-retail:counter:${BRANCH_ID}`, COUNTER);
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), "GET /settings": [200, SETTINGS] });
    const user = userEvent.setup();
    at("/money");
    expect(screen.queryByRole("button", { name: "Expense" })).not.toBeInTheDocument(); // cashier
    await user.selectOptions(await screen.findByLabelText("Customer"), MEERA.id);
    await user.click(screen.getByRole("button", { name: "Fill the full ₹590.00" }));
    await user.click(screen.getByRole("button", { name: "Save ₹590.00" }));
    expect(await screen.findByText(/saved on this counter/)).toBeInTheDocument();
    const [q] = await db.money.toArray();
    expect(q!.payload).toMatchObject({ kind: "customer_payment", customerId: MEERA.id, amount: 59000, methodId: METHODS[0]!.id });
    // Balance shown on the counter already counts it.
    expect(await screen.findByRole("option", { name: "Meera · 9900011111" })).toBeInTheDocument();

    vi.restoreAllMocks();
    const { calls } = mockApi({ "POST /sync/money": (body) => [200, { results: (body as { ops: { id: string }[] }).ops.map((o) => ({ id: o.id, status: "saved" })) }] });
    expect(await flushOutbox()).toMatchObject({ state: "done", saved: 1 });
    expect(calls.map((c) => c.path)).toEqual(["/sync/money"]);
    expect(await db.money.count()).toBe(0);
  });
});
