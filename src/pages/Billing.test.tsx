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
      // Cash is the default payment method.
      payments: [{ methodId: METHODS[0]!.id, amount: 69500 }],
      total: 69500,
    });
    expect(queued!.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("a VAT shop: the shop's tax groups, words and currency on the bill and the receipt", async () => {
    const STD = "66666666-6666-4666-8666-000000000001";
    const HOTEL = "66666666-6666-4666-8666-000000000002";
    const taxGroups = [
      { id: STD, name: "Standard", taxes: [{ name: "VAT", rateBp: 500 }], isDefault: true, rateBp: 500, products: 2 },
      { id: HOTEL, name: "Hotel", taxes: [{ name: "VAT", rateBp: 500 }, { name: "Tourism fee", rateBp: 200 }], isDefault: false, rateBp: 700, products: 1 },
    ];
    const products = [{ ...PRODUCTS[0]!, price: 10500 }, { ...PRODUCTS[1]!, name: "Room night", price: 10700, taxGroupId: HOTEL }];
    const settings = { taxMode: "CUSTOM" as const, taxLabel: "VAT", taxNumberLabel: "TRN", itemCodeLabel: "", invoiceTitle: "Tax invoice", business: { ...SETTINGS.business, currency: "AED", timezone: "Asia/Dubai" } };
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ products, settings, taxGroups }) });
    const user = userEvent.setup();
    renderBilling();
    expect(await screen.findByRole("button", { name: /Wheat Atta.*VAT 5%/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Room night.*VAT 5% \+ Tourism fee 2%/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Wheat Atta/ }));
    await user.click(screen.getByRole("button", { name: /Room night/ }));

    const bill = screen.getByRole("complementary", { name: "Current bill" });
    expect(within(bill).getByText("VAT 5%").nextSibling).toHaveTextContent("AED 10.00");
    expect(within(bill).getByText("Tourism fee 2%").nextSibling).toHaveTextContent("AED 2.00");
    expect(within(bill).queryByText("CGST")).toBeNull();
    expect(within(bill).getByText("Total (incl. VAT)")).toBeInTheDocument();
    await user.click(within(bill).getByRole("button", { name: "Cash" }));
    await user.click(within(bill).getByRole("button", { name: /^Charge AED\s?212\.00/ }));

    const receipt = await screen.findByLabelText("TAX INVOICE B1-C1-00001");
    expect(receipt).toHaveTextContent("VAT 5%10.00");
    expect(receipt).toHaveTextContent("Tourism fee 2%2.00");
    expect(receipt).toHaveTextContent("Two Hundred Twelve United Arab Emirates Dirhams Only");
    expect(receipt).not.toHaveTextContent("HSN");
    expect(receipt).not.toHaveTextContent("Amounts are in ₹");
    const [queued] = await db.outbox.toArray();
    expect(queued!.payload).toMatchObject({
      taxMode: "CUSTOM",
      total: 21200,
      lines: [
        { productId: PRODUCTS[0]!.id, taxes: [{ name: "VAT", rateBp: 500 }] },
        { productId: PRODUCTS[1]!.id, taxes: [{ name: "VAT", rateBp: 500 }, { name: "Tourism fee", rateBp: 200 }] },
      ],
    });
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

  it("splits a bill across cash and UPI: the last part is the balance, and the QR asks for the UPI part", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ settings: { taxEnabled: false, upiId: "sharma@okaxis" } }) });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: "One more Tea 250 g" }));
    const bill = screen.getByRole("complementary", { name: "Current bill" });
    await user.click(within(bill).getByRole("button", { name: "Split" }));
    // Udhaar can't be part of a split.
    expect(within(screen.getByLabelText("Payment method for part 1")).queryByRole("option", { name: /Udhaar/ })).toBeNull();
    expect(screen.getByLabelText("Payment method for part 1")).toHaveDisplayValue("Cash");
    expect(screen.getByLabelText("Payment method for part 2")).toHaveDisplayValue("UPI");
    expect(within(bill).getByRole("button", { name: "Charge ₹290.00" })).toBeDisabled();
    await user.type(screen.getByLabelText("Amount for part 1"), "250");
    expect(screen.getByLabelText("Balance for part 2")).toHaveTextContent("₹40.00");
    expect(within(bill).getByText("Scan to pay ₹40.00")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Cash received/), "300");
    expect(screen.getByText("Change ₹50.00")).toBeInTheDocument();
    await user.click(within(bill).getByRole("button", { name: "Charge ₹290.00" }));
    expect(await screen.findByRole("dialog", { name: "Bill B1-C1-00001 saved" })).toBeInTheDocument();
    const [queued] = await db.outbox.toArray();
    expect(queued!.payload.payments).toEqual([
      { methodId: METHODS[0]!.id, amount: 25000 },
      { methodId: METHODS[1]!.id, amount: 4000 },
    ]);
    const receipt = screen.getByLabelText("INVOICE B1-C1-00001");
    expect(receipt).toHaveTextContent("Cash250.00");
    expect(receipt).toHaveTextContent("UPI40.00");
    // The receipt QR is off by default and can be switched on for this one.
    expect(within(receipt).queryByText(/Scan to pay/)).toBeNull();
    await user.click(screen.getByLabelText("Print UPI QR for ₹40.00 on this receipt"));
    expect(await within(receipt).findByText("Scan to pay ₹40.00 by UPI")).toBeInTheDocument();
  });

  it("won't charge a split that doesn't add up", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), ...posRoutes({ settings: { taxEnabled: false } }) });
    const user = userEvent.setup();
    renderBilling();
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    const bill = screen.getByRole("complementary", { name: "Current bill" });
    await user.click(within(bill).getByRole("button", { name: "Split" }));
    await user.type(screen.getByLabelText("Amount for part 1"), "200");
    expect(screen.getByLabelText("Balance for part 2")).toHaveTextContent("-₹55.00");
    expect(screen.getByText("Parts add up to ₹55.00 more than the total.")).toBeInTheDocument();
    expect(within(bill).getByRole("button", { name: /^Charge/ })).toBeDisabled();
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
