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

const savedOrder = (body: { id: string; lines: { productId: string; qtyMilli: number }[] }) => ({
  order: {
    id: body.id,
    invoiceNumber: "B1-C1-00001",
    status: "COMPLETED",
    createdAt: "2026-11-04T10:00:00.000Z",
    branch: { id: "b", code: "B1", name: "Main branch", address: "", phone: "", gstin: "29ABCDE1234F1Z5", stateCode: "29" },
    counter: { code: "C1", name: "Counter 1" },
    cashierId: "c",
    cashierName: "Anil",
    customer: null,
    placeOfSupply: "29",
    interState: false,
    taxEnabled: true,
    discount: { type: "flat", value: 0 },
    subtotal: 69500,
    discountTotal: 0,
    taxableTotal: 64931,
    cgstTotal: 2284,
    sgstTotal: 2285,
    igstTotal: 0,
    total: 69500,
    returnedTotal: 0,
    note: "",
    cancelledAt: null,
    cancelReason: "",
    items: [],
    payments: [{ methodId: METHODS[1]!.id, methodName: "UPI", kind: "UPI", amount: 69500 }],
    creditNotes: [],
  },
});

describe("billing", () => {
  it("adds items, shows the same GST totals as the server, and charges", async () => {
    let posted: { id: string; lines: { productId: string; qtyMilli: number }[]; payments: unknown[]; counterId: string } | undefined;
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      ...posRoutes(),
      "POST /orders": (body) => {
        posted = body as typeof posted;
        return [201, savedOrder(posted!)];
      },
    });
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
    expect(posted).toMatchObject({
      counterId: "33333333-3333-4333-8333-333333333333",
      lines: [
        { productId: PRODUCTS[0]!.id, qtyMilli: 1000 },
        { productId: PRODUCTS[1]!.id, qtyMilli: 2000 },
        { productId: PRODUCTS[2]!.id, qtyMilli: 1000 },
      ],
      payments: [{ methodId: METHODS[1]!.id, amount: 69500 }],
    });
    expect(posted!.id).toMatch(/^[0-9a-f-]{36}$/);
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

  it("queues the bill with the same id and number when the network drops mid-charge", async () => {
    let tried: { id: string; invoiceNumber: string } | undefined;
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      ...posRoutes(),
      "POST /orders": (body) => {
        tried = body as typeof tried;
        throw new TypeError("Failed to fetch");
      },
    });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00001 saved" })).toBeInTheDocument();
    const [queued] = await db.outbox.toArray();
    expect(queued!.id).toBe(tried!.id);
    expect(tried!.invoiceNumber).toBe("B1-C1-00001");
  });

  it("shows the server's reason when a bill is refused", async () => {
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      ...posRoutes(),
      "POST /orders": [409, { error: { code: "out_of_stock", message: "Not enough stock: Tea 250 g." } }],
    });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    expect(await screen.findByText("Not enough stock: Tea 250 g.")).toBeInTheDocument();
    expect(SETTINGS.taxEnabled).toBe(true);
  });
});
