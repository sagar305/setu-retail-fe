import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../../auth/AuthProvider";
import { setAccessToken } from "../../lib/api";
import { kindFor } from "../../lib/barcodes";
import { BRANCH_ID, makeMe, makePack, METHODS, mockApi, posRoutes, PRODUCTS, SETTINGS, session } from "../../test/mockApi";

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

const buckets = [
  { key: "current", label: "Not due" },
  { key: "d30", label: "1–30 days" },
  { key: "d60", label: "31–60 days" },
  { key: "d90", label: "61–90 days" },
  { key: "d90plus", label: "90+ days" },
];
const B = (o: Partial<Record<string, number>>) => ({ current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0, ...o });

describe("report tools", () => {
  it("Invoice Aging shows buckets and lets the owner change credit days", async () => {
    let patched: unknown;
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": [200, { ...SETTINGS, creditDays: 15 }],
      "PATCH /settings": (b) => {
        patched = b;
        return [200, { ...SETTINGS, creditDays: 30 }];
      },
      "GET /reports/aging/customers": [
        200,
        {
          asOf: "2026-11-04",
          creditDays: 15,
          buckets,
          totals: B({ current: 14500, d60: 50000 }),
          total: 64500,
          parties: [
            {
              customerId: "c1",
              name: "Meera",
              phone: "9900011111",
              creditDays: 15,
              open: 64500,
              buckets: B({ current: 14500, d60: 50000 }),
              maxDaysOverdue: 45,
              items: [{ id: "i1", type: "opening", ref: "", at: "2026-09-05T00:00:00.000Z", dueDate: null, amount: 50000, paid: 0, open: 50000, dueDay: "2026-09-20", bucket: "d60", daysOverdue: 45 }],
            },
          ],
        },
      ],
    });
    const user = userEvent.setup();
    at("/tools/invoice-aging");
    expect(await screen.findByRole("button", { name: "Meera" })).toBeInTheDocument();
    expect(screen.getAllByText("₹500.00").length).toBeGreaterThan(0);
    expect(screen.getByText(/45 days overdue/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Meera" }));
    expect(screen.getByRole("link", { name: /Open ledger/ })).toHaveAttribute("href", "/tools/customer-ledger/c1");
    await user.click(screen.getByRole("button", { name: "Credit days: 15" }));
    const dlg = screen.getByRole("dialog", { name: "Credit days" });
    await user.clear(within(dlg).getByLabelText("Days"));
    await user.type(within(dlg).getByLabelText("Days"), "30");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(patched).toEqual({ creditDays: 30 });
    expect(await screen.findByRole("button", { name: "Credit days: 30" })).toBeInTheDocument();
  });

  it("Profit Dashboard shows net profit and warns about items with no cost", async () => {
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": [200, SETTINGS],
      "GET /reports/profit": [
        200,
        { from: "2026-11-01", to: "2026-11-04", period: "day", revenue: 15809, cost: 12000, expenses: 1000, grossProfit: 3809, netProfit: 2809, grossMarginBp: 2409, uncosted: { lines: 1, revenue: 2000 }, byPeriod: [{ period: "2026-11-04", revenue: 15809, cost: 12000, expenses: 1000, grossProfit: 3809, netProfit: 2809 }], byBranch: [{ branchId: BRANCH_ID, revenue: 15809, cost: 12000, expenses: 1000, grossProfit: 3809, netProfit: 2809 }], expensesByCategory: [{ category: "Electricity", amount: 1000 }] },
      ],
    });
    at("/tools/profit");
    expect(await screen.findByText(/1 sold item line/)).toBeInTheDocument();
    expect(screen.getByText("Gross profit · 24.09%")).toBeInTheDocument();
    expect(screen.getAllByText("₹28.09").length).toBeGreaterThan(0);
    expect(screen.getByText("Electricity")).toBeInTheDocument();
  });

  it("billing prints with the branch's receipt design; the cashier can switch", async () => {
    const t = (id: string, name: string, over = {}) => ({ id, name, paperSize: "80mm", accentColor: "#26306B", headerText: "", footerText: "", showLogo: false, showBusinessInfo: true, showGstin: true, showHsn: true, showGstSummary: true, showAmountWords: true, boldTotals: true, separator: "dashed", isDefault: false, ...over });
    const pack = makePack();
    pack.branch.receiptTemplateId = "t2";
    pack.receiptTemplates = [t("t1", "Classic", { isDefault: true, footerText: "Default footer" }), t("t2", "Festive", { footerText: "Happy Diwali!", headerText: "Free delivery above ₹500", showHsn: false, showAmountWords: false })];
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      ...posRoutes(),
      "GET /sync/pack": [200, pack],
      "POST /orders": (body) => {
        const b = body as { id: string; invoiceNumber: string };
        return [201, { order: { id: b.id, invoiceNumber: b.invoiceNumber, status: "COMPLETED", createdAt: "2026-11-04T10:00:00.000Z", branch: pack.branch, counter: { code: "C1", name: "Counter 1" }, cashierId: "c", cashierName: "Anil", customer: null, placeOfSupply: null, interState: false, taxEnabled: true, discount: { type: "flat", value: 0 }, subtotal: 14500, discountTotal: 0, taxableTotal: 13810, cgstTotal: 345, sgstTotal: 345, igstTotal: 0, total: 14500, returnedTotal: 0, note: "", cancelledAt: null, cancelReason: "", offline: false, priceDiffers: false, items: [{ id: "i", productId: PRODUCTS[1]!.id, name: "Tea 250 g", hsn: "0902", unit: "pcs", qtyMilli: 1000, unitPrice: 14500, gstRateBp: 500, taxInclusive: true, gross: 14500, discount: 0, taxable: 13810, cgst: 345, sgst: 345, igst: 0, total: 14500, returnedQtyMilli: 0, batches: [] }], payments: [{ methodId: METHODS[1]!.id, methodName: "UPI", kind: "UPI", amount: 14500 }], creditNotes: [] } }];
      },
    });
    const user = userEvent.setup();
    at("/billing");
    await user.click(await screen.findByRole("button", { name: /Tea 250 g/ }));
    await user.click(screen.getByRole("button", { name: /^Charge/ }));
    const receipt = await screen.findByLabelText(/TAX INVOICE/);
    expect(receipt).toHaveTextContent("Happy Diwali!");
    expect(receipt).toHaveTextContent("Free delivery above ₹500");
    expect(receipt).not.toHaveTextContent("HSN 0902");
    expect(receipt).not.toHaveTextContent("Rupees");
    await user.selectOptions(screen.getByLabelText("Receipt design"), "t1");
    expect(screen.getByLabelText(/TAX INVOICE/)).toHaveTextContent("Default footer");
    expect(screen.getByLabelText(/TAX INVOICE/)).toHaveTextContent("HSN 0902");
  });

  it("picks EAN-13 only for valid 13-digit codes", () => {
    expect(kindFor("8901234567890")).toBe("EAN13");
    expect(kindFor("8901234567891")).toBe("CODE128");
    expect(kindFor("SKU-1")).toBe("CODE128");
  });

  it("the barcode page makes barcodes for chosen products without one", async () => {
    let asked: unknown;
    const noCode = { ...PRODUCTS[2]!, barcode: "", sku: "" };
    mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": [200, SETTINGS],
      "GET /products": [200, { products: [PRODUCTS[0], noCode], total: 2 }],
      "POST /products/barcodes": (b) => {
        asked = b;
        return [200, { generated: [{ productId: noCode.id, barcode: "2123456789012" }], skipped: 0 }];
      },
    });
    const user = userEvent.setup();
    at("/tools/barcodes");
    const input = await screen.findByLabelText("Labels for Detergent 1 kg");
    await user.clear(input);
    await user.type(input, "3");
    expect(screen.getByText(/1 chosen product\(s\) have no barcode/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make barcodes for them" }));
    expect(asked).toEqual({ productIds: [noCode.id] });
    expect(await screen.findByText(/Made 1 barcode/)).toBeInTheDocument();
    expect(screen.getByText(/Code 128 2123456789012|EAN-13 2123456789012/)).toBeInTheDocument();
  });
});
