import { db } from "../offline/db";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { makeMe, mockApi, posRoutes, PRODUCTS, session } from "../test/mockApi";

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

const dashboard = {
  today: { sales: 93500, net: 79000, bills: 2, averageBill: 46750, returns: 14500, creditGiven: 0, byPayment: [{ method: "UPI", kind: "UPI", amount: 69500 }], byBranch: [], topProducts: [{ productId: "p", name: "Detergent", unit: "pcs", qtyMilli: 3000, amount: 36000 }] },
  yesterday: { sales: 50000, bills: 1 },
  week: ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map((day, i) => ({ day, sales: i === 6 ? 93500 : 0, bills: i === 6 ? 2 : 0 })),
  lowStock: [{ productId: "p", name: "Floor cleaner", unit: "pcs", branchId: "b", stockMilli: -2000, status: "negative" }],
  expiringSoon: 3,
};

describe("dashboard", () => {
  it("shows today, the week, alerts and low stock", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), "GET /reports/dashboard": [200, dashboard] });
    at("/dashboard");
    expect(await screen.findByText("₹935.00")).toBeInTheDocument();
    expect(screen.getByText("+87% vs yesterday")).toBeInTheDocument();
    expect(screen.getByText(/below zero stock \(Floor cleaner\)/)).toBeInTheDocument();
    expect(screen.getByText(/3 batches expire within 30 days/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Daily sales for the last 7 days/ })).toBeInTheDocument();
  });
});

describe("reports", () => {
  it("GST tab: net by rate, B2B with state names", async () => {
    let asked = "";
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /reports/sales": [200, { from: "", to: "", bills: 0, gross: 0, discounts: 0, sales: 0, returns: 0, returnCount: 0, net: 0, averageBill: 0, cancelled: { count: 0, total: 0 }, byPayment: [], refundsByMethod: [], topProducts: [], byBranch: [], byDay: [] }],
      "GET /reports/gst": (_b, url) => {
        asked = url.search;
        return [200, {
          from: "", to: "",
          byRate: [{ rateBp: 500, sales_taxable: 54762, sales_cgst: 1369, sales_sgst: 1369, sales_igst: 0, sales_total: 57500, returns_taxable: 13810, returns_cgst: 345, returns_sgst: 345, returns_igst: 0, returns_total: 14500, net_taxable: 40952, net_cgst: 1024, net_sgst: 1024, net_igst: 0, net_total: 43000 }],
          byHsn: [{ hsn: "0902", rateBp: 500, unit: "pcs", qtyMilli: 2000, taxable: 27619, cgst: 690, sgst: 691, igst: 0, total: 29000 }],
          b2b: [{ invoiceNumber: "B1-C1-00002", date: "2026-11-04T06:00:00.000Z", customerName: "Pune Traders", customerGstin: "27ABCDE1234F1Z5", placeOfSupply: "27", interState: true, taxable: 20339, cgst: 0, sgst: 0, igst: 3661, total: 24000 }],
          b2c: [],
          creditNotes: [],
        }];
      },
    });
    const user = userEvent.setup();
    at("/reports");
    await user.click(await screen.findByRole("button", { name: "GST" }));
    const table = (await screen.findByRole("heading", { name: /By GST rate/ })).closest("section")!;
    expect(within(table).getByText("₹409.52")).toBeInTheDocument();
    expect(screen.getByText("Maharashtra (27)")).toBeInTheDocument();
    expect(asked).toMatch(/from=.*&to=/);
  });
});

describe("batches at the counter", () => {
  it("lets the cashier pick a batch and sends it with the bill", async () => {
    const syrup = { ...PRODUCTS[1]!, name: "Cough syrup", nextExpiry: "2026-11-20" };
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      ...posRoutes({ products: [syrup], settings: { batchTracking: true } }),
      [`GET /products/${syrup.id}/batches`]: [200, { batches: [
        { id: "88888888-8888-4888-8888-000000000001", productId: syrup.id, batchNo: "E-26", expiry: "2026-11-20", costPrice: null, qtyMilli: 3000, opening: false, receivedAt: "2026-01-01T00:00:00.000Z", status: "soon" },
        { id: "88888888-8888-4888-8888-000000000002", productId: syrup.id, batchNo: "L-27", expiry: "2027-06-30", costPrice: null, qtyMilli: 5000, opening: false, receivedAt: "2026-01-01T00:00:00.000Z", status: "ok" },
      ] }],
    });
    const user = userEvent.setup();
    at("/billing");
    expect(await screen.findByText(/Exp 20 Nov 2026/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cough syrup/ }));
    await user.click(screen.getByRole("button", { name: /Batch: earliest expiry/ }));
    await user.click(await screen.findByRole("button", { name: /L-27/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    // Saved on the counter with the picked batch; the cloud gets it in the background (Phase 9b).
    await screen.findByRole("dialog", { name: /saved/ });
    const [queued] = await db.outbox.toArray();
    expect(queued!.payload.lines[0]!.batchId).toBe("88888888-8888-4888-8888-000000000002");
  });
});
