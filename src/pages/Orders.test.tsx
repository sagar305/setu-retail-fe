import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { db } from "../offline/db";
import { makeMe, METHODS, mockApi, posRoutes, session } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const ITEM = "66666666-6666-4666-8666-000000000001";
const order = {
  id: "77777777-7777-4777-8777-000000000001",
  invoiceNumber: "B1-C1-00007",
  status: "COMPLETED",
  createdAt: "2026-11-04T10:00:00.000Z",
  branch: { id: "00000000-0000-4000-8000-000000000001", code: "B1", name: "Main branch", address: "", phone: "", gstin: null, stateCode: "29" },
  counter: { code: "C1", name: "Counter 1" },
  cashierId: "c",
  cashierName: "Anil",
  customer: null,
  placeOfSupply: "29",
  interState: false,
  taxEnabled: true,
  discount: { type: "flat", value: 0 },
  subtotal: 29000,
  discountTotal: 0,
  taxableTotal: 27619,
  cgstTotal: 690,
  sgstTotal: 691,
  igstTotal: 0,
  total: 29000,
  returnedTotal: 0,
  note: "",
  cancelledAt: null,
  cancelReason: "",
  items: [{ id: ITEM, productId: null, name: "Tea 250 g", hsn: "0902", unit: "pcs", qtyMilli: 2000, unitPrice: 14500, gstRateBp: 500, taxInclusive: true, gross: 29000, discount: 0, taxable: 27619, cgst: 690, sgst: 691, igst: 0, total: 29000, returnedQtyMilli: 0 }],
  payments: [{ methodId: METHODS[1]!.id, methodName: "UPI", kind: "UPI", amount: 29000 }],
  creditNotes: [],
};
const summary = { id: order.id, invoiceNumber: order.invoiceNumber, status: "COMPLETED", createdAt: order.createdAt, branchId: order.branch.id, customerName: "", total: 29000, returnedTotal: 0, cashierId: "c", paymentMethods: ["UPI"] };

function renderOrders() {
  return render(
    <MemoryRouter initialEntries={["/orders"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("orders", () => {
  it("a manager returns one item and gets a credit note", async () => {
    let posted: unknown;
    mockApi({
      "POST /auth/refresh": session(makeMe({ role: "MANAGER" })),
      ...posRoutes(),
      "GET /orders": [200, { orders: [summary] }],
      [`GET /orders/${order.id}`]: [200, { order }],
      [`POST /orders/${order.id}/returns`]: (body) => {
        posted = body;
        return [201, { order: { ...order, returnedTotal: 14500, creditNotes: [{ id: "cn1", number: "CN-B1-C1-00001", reason: "Damaged", refundMethodName: "UPI", taxableTotal: 13810, cgstTotal: 345, sgstTotal: 345, igstTotal: 0, total: 14500, createdAt: order.createdAt, items: [{ orderItemId: ITEM, qtyMilli: 1000, total: 14500 }] }] } }];
      },
    });
    const user = userEvent.setup();
    renderOrders();
    await user.click(await screen.findByRole("button", { name: "B1-C1-00007" }));
    await user.click(await screen.findByRole("button", { name: "Return items" }));
    await user.type(screen.getByLabelText("Return quantity of Tea 250 g"), "1");
    await user.type(screen.getByLabelText("Reason"), "Damaged");
    await user.click(screen.getByRole("button", { name: "Return and issue credit note" }));
    // Saved on this device at once; the credit note shows when the cloud has it (Phase 9b).
    expect(await screen.findByText(/Return saved/)).toBeInTheDocument();
    const [change] = await db.changes.toArray();
    expect(change).toMatchObject({ method: "POST", path: `/orders/${order.id}/returns`, status: "pending" });
    mockApi({
      [`POST /orders/${order.id}/returns`]: (body) => {
        posted = body;
        return [201, { order: { ...order, returnedTotal: 14500, creditNotes: [{ id: "cn1", number: "CN-B1-C1-00001", reason: "Damaged", refundMethodName: "UPI", taxableTotal: 13810, cgstTotal: 345, sgstTotal: 345, igstTotal: 0, total: 14500, createdAt: order.createdAt, items: [{ orderItemId: ITEM, qtyMilli: 1000, total: 14500 }] }] } }];
      },
      [`GET /orders/${order.id}`]: () => [200, { order: { ...order, returnedTotal: 14500, creditNotes: [{ id: "cn1", number: "CN-B1-C1-00001", reason: "Damaged", refundMethodName: "UPI", taxableTotal: 13810, cgstTotal: 345, sgstTotal: 345, igstTotal: 0, total: 14500, createdAt: order.createdAt, items: [{ orderItemId: ITEM, qtyMilli: 1000, total: 14500 }] }] } }],
    });
    const { flushChanges } = await import("../lib/changes");
    expect(await flushChanges()).toMatchObject({ sent: 1, state: "done" });
    expect(await screen.findByText("CN-B1-C1-00001")).toBeInTheDocument();
    expect(posted).toMatchObject({ counterId: "33333333-3333-4333-8333-333333333333", items: [{ orderItemId: ITEM, qtyMilli: 1000 }], refundMethodId: METHODS[1]!.id, reason: "Damaged" });
  });

  it("won't return more than was sold", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "MANAGER" })), ...posRoutes(), "GET /orders": [200, { orders: [summary] }], [`GET /orders/${order.id}`]: [200, { order }] });
    const user = userEvent.setup();
    renderOrders();
    await user.click(await screen.findByRole("button", { name: "B1-C1-00007" }));
    await user.click(await screen.findByRole("button", { name: "Return items" }));
    await user.type(screen.getByLabelText("Return quantity of Tea 250 g"), "3");
    await user.type(screen.getByLabelText("Reason"), "x");
    expect(screen.getByRole("button", { name: "Return and issue credit note" })).toBeDisabled();
  });

  it("cashiers see their own sales but can't cancel or return", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), ...posRoutes(), "GET /orders": [200, { orders: [summary] }], [`GET /orders/${order.id}`]: [200, { order }] });
    const user = userEvent.setup();
    renderOrders();
    expect(await screen.findByRole("heading", { name: "My sales today" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "B1-C1-00007" }));
    expect(await screen.findByRole("button", { name: "Print bill" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Return items" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel bill" })).not.toBeInTheDocument();
  });
});
