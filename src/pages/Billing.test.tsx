import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { db } from "../offline/db";
import { COUNTER, makeMe, METHODS, mockApi, posRoutes, PRODUCTS, SETTINGS, session } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
  Object.defineProperty(navigator, "onLine", { configurable: true, get: () => true });
});

function renderBilling() {
  return render(
    <MemoryRouter initialEntries={["/billing"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}


describe("billing", () => {
  it("adds items, shows the same GST totals as the server, and charges at once (the cloud gets it in the background)", async () => {
    const api = mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes() });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Wheat Atta/ }));
    await user.click(screen.getByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: "One more Tea 250 g" }));
    await user.click(screen.getByRole("button", { name: /Detergent/ }));

    const bill = screen.getByRole("complementary", { name: "Current bill" });
    expect(within(bill).getByText("₹649.31")).toBeInTheDocument();
    expect(within(bill).getByText("₹22.84")).toBeInTheDocument();
    expect(within(bill).getByText("₹22.85")).toBeInTheDocument();
    expect(within(bill).getByText("₹695.00")).toBeInTheDocument();

    await user.click(within(bill).getByRole("button", { name: "Charge ₹695.00" }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00001 saved" })).toBeInTheDocument();
    expect(screen.getByLabelText("TAX INVOICE B1-C1-00001")).toHaveTextContent("Rupees Six Hundred Ninety-Five Only");
    // Saved on the counter; no waiting on the cloud (decision v1.9).
    expect(api.calls.some((c) => c.method === "POST" && c.path === "/orders")).toBe(false);
    const [queued] = await db.outbox.toArray();
    expect(queued).toMatchObject({ counterId: COUNTER, invoiceNumber: "B1-C1-00001", status: "pending" });
    expect(queued!.payload).toMatchObject({
      lines: [
        { productId: PRODUCTS[0]!.id, qtyMilli: 1000 },
        { productId: PRODUCTS[1]!.id, qtyMilli: 2000 },
        { productId: PRODUCTS[2]!.id, qtyMilli: 1000 },
      ],
      payments: [{ methodId: METHODS[1]!.id, amount: 69500 }],
      total: 69500,
    });
    expect(queued!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("adds a product by scanning its barcode", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes() });
    const user = userEvent.setup();
    renderBilling();
    await user.type(await screen.findByLabelText("Search products"), "8901234567890{Enter}");
    expect(screen.getByLabelText("Quantity of Wheat Atta 5 kg")).toHaveValue("1");
    expect(screen.getByLabelText("Search products")).toHaveValue("");
  });

  it("weighs loose quantities typed by hand", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ settings: { taxEnabled: false } }) });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    const qty = screen.getByLabelText("Quantity of Tea 250 g");
    await user.clear(qty);
    await user.type(qty, "1.5{Enter}");
    expect(screen.getByRole("button", { name: "Charge ₹217.50" })).toBeInTheDocument();
    expect(screen.queryByText("CGST")).not.toBeInTheDocument();
  });

  it("shows change for cash and requires a customer for udhaar", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes() });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: "Cash" }));
    await user.type(screen.getByLabelText("Cash received"), "200");
    expect(screen.getByText("Change ₹55.00")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Udhaar" }));
    expect(screen.getByText(/Pick a saved customer/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Charge/ })).toBeDisabled();
  });

  it("keeps a cashier's discount within the owner's cap", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), ...posRoutes() });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Wheat Atta/ }));
    await user.click(screen.getByRole("button", { name: "Add (max 10%)" }));
    await user.click(screen.getByRole("button", { name: "Percent (%)" }));
    await user.type(screen.getByLabelText("Discount in %"), "15");
    expect(screen.getByText("Cashiers can give up to 10%.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Discount in %"));
    await user.type(screen.getByLabelText("Discount in %"), "10");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("button", { name: "Charge ₹256.50" })).toBeInTheDocument();
  });

  it("blocks out-of-stock items when the owner turned selling below zero off", async () => {
    const out = { ...PRODUCTS[2]!, stockMilli: 0, stockStatus: "out" };
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ products: [PRODUCTS[0], out], settings: { allowNegativeStock: false } }) });
    renderBilling();
    expect(await screen.findByRole("button", { name: /Detergent/ })).toBeDisabled();
  });

  it("keeps billing with no internet: the bill is saved on this counter with the next number", async () => {
    const { calls } = mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ nextInvoiceNumber: 7 }) });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    window.dispatchEvent(new Event("offline"));
    expect(await screen.findByText(/Bills are saved on this counter/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Charge ₹145.00" }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00007 saved" })).toBeInTheDocument();
    expect(screen.getByText(/syncs automatically when the internet is back/)).toBeInTheDocument();
    expect(calls.some((c) => c.path === "/orders")).toBe(false);

    const [queued] = await db.outbox.toArray();
    expect(queued).toMatchObject({ invoiceNumber: "B1-C1-00007", status: "pending", counterId: COUNTER });
    expect(queued!.payload).toMatchObject({ invoiceNumber: "B1-C1-00007", total: 14500, lines: [{ productId: PRODUCTS[1]!.id, qtyMilli: 1000, unitPrice: 14500 }] });

    // Stock on the counter already counts the bill; the next one takes the next number.
    await user.click(screen.getByRole("button", { name: "New bill" }));
    expect(await screen.findByText("9 pcs")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00008 saved" })).toBeInTheDocument();
  });

  it("a bill the cloud refuses later is kept on the counter with the reason", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes() });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00001 saved" })).toBeInTheDocument();
    const [queued] = await db.outbox.toArray();
    mockApi({ "POST /sync/orders": [200, { results: [{ id: queued!.id, status: "rejected", message: "Bill number already used by another bill." }] }], "POST /sync/customers": [200, { results: [] }], "POST /sync/money": [200, { results: [] }] });
    const { flushOutbox } = await import("../offline/outbox");
    await flushOutbox();
    expect(await db.outbox.get(queued!.id)).toMatchObject({ status: "rejected", message: "Bill number already used by another bill." });
    expect(SETTINGS.taxEnabled).toBe(true);
  });
});
