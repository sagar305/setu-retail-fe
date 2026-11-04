import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken, type OfflinePack } from "../lib/api";
import { writePref } from "../lib/storage";
import { BRANCH_ID, COUNTER, makePack, mockApi, PRODUCTS } from "../test/mockApi";
import { kvSet, db } from "./db";
import { flushOutbox, queueOrder } from "./outbox";
import { checkPin } from "./pin";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const SALT = "00112233445566778899aabbccddeeff";
// What the server stores for PIN 4321: PBKDF2-SHA256(pin, salt, 1000 iterations), hex.
async function verifier(pin: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const salt = new Uint8Array(SALT.match(/../g)!.map((b) => parseInt(b, 16)));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 1000 }, key, 256);
  return { hash: [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join(""), salt: SALT, iterations: 1000 };
}
const CASHIER = { id: "66666666-6666-4666-8666-000000000001", name: "Ravi Kumar", username: "ravi", role: "CASHIER" as const, pin: await verifier("4321") };

async function setUpCounter(over: Parameters<typeof makePack>[0] = {}) {
  const pack = makePack({ users: [CASHIER], ...over }) as OfflinePack;
  await db.packs.put({ branchId: BRANCH_ID, pack, fetchedAt: pack.at });
  await kvSet(`deviceKey:${COUNTER}`, `${COUNTER}.secret`);
  writePref(`setu-retail:counter:${BRANCH_ID}`, COUNTER);
  return pack;
}

const noInternet = () => vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));

describe("counter PIN", () => {
  it("checks a PIN against the server's PBKDF2 verifier", async () => {
    expect(await checkPin("4321", CASHIER.pin)).toBe(true);
    expect(await checkPin("1234", CASHIER.pin)).toBe(false);
  });

  it("signs a cashier in with their PIN when there's no internet, and bills", async () => {
    await setUpCounter({ nextInvoiceNumber: 3 });
    noInternet();
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));
    await user.type(screen.getByLabelText("Counter PIN"), "1111");
    await user.click(screen.getByRole("button", { name: "Sign in offline" }));
    expect(await screen.findByText("Wrong PIN.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Counter PIN"), "4321");
    await user.click(screen.getByRole("button", { name: "Sign in offline" }));

    expect(await screen.findByText(/Cashier · signed in offline/)).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /Wheat Atta/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00003 saved" })).toBeInTheDocument();
    const [queued] = await db.outbox.toArray();
    expect(queued!.payload.cashierId).toBe(CASHIER.id);
  });
});

describe("sync", () => {
  const queue = (n: number) =>
    queueOrder({
      id: `77777777-7777-4777-8777-00000000000${n}`,
      counterId: COUNTER,
      branchId: BRANCH_ID,
      invoiceNumber: `B1-C1-0000${n}`,
      createdAt: `2026-11-04T10:0${n}:00.000Z`,
      order: {} as never,
      payload: { id: `77777777-7777-4777-8777-00000000000${n}`, cashierId: CASHIER.id, invoiceNumber: `B1-C1-0000${n}`, createdAt: `2026-11-04T10:0${n}:00.000Z`, customerId: null, taxEnabled: true, discount: { type: "flat", value: 0 }, lines: [{ productId: PRODUCTS[0]!.id, name: "Wheat Atta 5 kg", hsn: "1101", unit: "pcs", unitPrice: 28500, gstRateBp: 500, taxInclusive: true, qtyMilli: 1000, batchId: null }], payments: [{ methodId: "m", amount: 28500 }], total: 28500 },
    });

  it("pushes queued bills in order with the device key and clears them", async () => {
    await setUpCounter();
    await queue(2);
    await queue(1);
    const { calls, spy } = mockApi({
      "POST /sync/orders": (body) => [200, { results: (body as { orders: { id: string }[] }).orders.map((o, i) => ({ id: o.id, status: i ? "duplicate" : "saved" })) }],
    });
    expect(await flushOutbox()).toMatchObject({ state: "done", saved: 2 });
    expect((calls[0]!.body as { orders: { invoiceNumber: string }[] }).orders.map((o) => o.invoiceNumber)).toEqual(["B1-C1-00001", "B1-C1-00002"]);
    expect(new Headers(spy.mock.calls[0]![1]!.headers).get("X-Device-Key")).toBe(`${COUNTER}.secret`);
    expect(await db.outbox.count()).toBe(0);
  });

  it("keeps bills waiting when the plan has ended, and marks refused ones", async () => {
    await setUpCounter();
    await queue(1);
    mockApi({ "POST /sync/orders": [402, { error: { code: "plan_expired", message: "Your plan has ended. Renew to sync." } }] });
    expect(await flushOutbox()).toMatchObject({ state: "blocked", message: "Your plan has ended. Renew to sync." });
    expect(await db.outbox.get("77777777-7777-4777-8777-000000000001")).toMatchObject({ status: "pending" });

    vi.restoreAllMocks();
    mockApi({ "POST /sync/orders": [200, { results: [{ id: "77777777-7777-4777-8777-000000000001", status: "rejected", message: "Unknown cashier" }] }] });
    expect(await flushOutbox()).toMatchObject({ state: "done", rejected: 1 });
    expect(await db.outbox.get("77777777-7777-4777-8777-000000000001")).toMatchObject({ status: "rejected", message: "Unknown cashier" });
  });
});

describe("internet back after a PIN shift", () => {
  it("asks for a password when the PIN user isn't the person signed in on this device", async () => {
    await setUpCounter();
    let online = false;
    const { makeMe, session } = await import("../test/mockApi");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (!online) throw new TypeError("Failed to fetch");
      const path = new URL(String(input)).pathname;
      if (path === "/auth/refresh") return new Response(JSON.stringify(session(makeMe())[1]), { status: 200 });
      return new Response("{}", { status: path === "/auth/logout" ? 204 : 200 });
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/billing"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole("button", { name: /Ravi Kumar/ }));
    await user.type(screen.getByLabelText("Counter PIN"), "4321");
    await user.click(screen.getByRole("button", { name: "Sign in offline" }));
    await screen.findByText(/signed in offline/);

    online = true;
    window.dispatchEvent(new Event("online"));
    await user.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByLabelText("Email or username")).toBeInTheDocument();
    expect(vi.mocked(fetch).mock.calls.some(([u]) => String(u).endsWith("/auth/logout"))).toBe(true);
  });
});
