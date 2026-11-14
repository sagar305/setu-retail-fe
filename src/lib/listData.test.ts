import { describe, expect, it } from "vitest";
import type { Customer, OrderSummary, Product } from "./api";
import { filterCustomers, filterOrders, filterProducts, withStockStatus } from "./listData";

const p = (over: Partial<Product>): Product => ({ id: "x", name: "Item", categoryId: null, sku: "", barcode: "", hsn: "", gstRateBp: 0, taxGroupId: null, taxInclusive: true, unit: "pcs", defaultPrice: 100, branchPrice: null, price: 100, trackStock: true, stockMilli: 10_000, lowStockMilli: null, stockStatus: "ok", archived: false, nextExpiry: null, ...over }) as Product;

describe("in-app filters match the API's rules", () => {
  it("products: name contains, SKU exact, barcode exact, HSN prefix; category (or none); stock status", () => {
    const rows = [
      p({ id: "1", name: "Wheat Atta 5 kg", sku: "AT-5", barcode: "890123", hsn: "1101", categoryId: "c1" }),
      p({ id: "2", name: "Tea 250 g", sku: "TEA", hsn: "0902", stockMilli: 2000, stockStatus: "low" }),
      p({ id: "3", name: "Detergent", stockMilli: 0, stockStatus: "out" }),
      p({ id: "4", name: "Gift wrap", trackStock: false, stockStatus: "untracked" }),
    ];
    const ids = (f: Partial<{ q: string; categoryId: string; stock: string }>) => filterProducts(rows, { q: "", categoryId: "", stock: "", ...f }).map((x) => x.id);
    expect(ids({ q: "atta" })).toEqual(["1"]);
    expect(ids({ q: "at" })).toEqual(["1"]); // "at" is in "Atta" only; SKU must match exactly
    expect(ids({ q: "at-5" })).toEqual(["1"]);
    expect(ids({ q: "890123" })).toEqual(["1"]);
    expect(ids({ q: "11" })).toEqual(["1"]);
    expect(ids({ categoryId: "c1" })).toEqual(["1"]);
    expect(ids({ categoryId: "none" })).toEqual(["2", "3", "4"]);
    expect(ids({ stock: "low" })).toEqual(["2"]);
    expect(ids({ stock: "out" })).toEqual(["3"]);
    expect(ids({ stock: "ok" })).toEqual(["1"]); // not the untracked one
  });

  it("stock status is worked out again after a stock edit on this device", () => {
    expect(withStockStatus(p({ stockMilli: 3000, stockStatus: "ok" })).stockStatus).toBe("low");
    expect(withStockStatus(p({ stockMilli: 0, stockStatus: "ok" })).stockStatus).toBe("out");
    expect(withStockStatus(p({ stockMilli: 9000, lowStockMilli: 10_000, stockStatus: "ok" })).stockStatus).toBe("low");
  });

  it("customers: name contains, mobile digits (3+) contain, tax number exact", () => {
    const c = (id: string, name: string, phone: string, gstin: string | null = null) => ({ id, name, phone, gstin }) as Customer;
    const rows = [c("1", "Meera Shah", "9876543210", "29ABCDE1234F1Z5"), c("2", "Ravi", "9123400000")];
    expect(filterCustomers(rows, "meera").map((x) => x.id)).toEqual(["1"]);
    expect(filterCustomers(rows, "98765").map((x) => x.id)).toEqual(["1"]);
    expect(filterCustomers(rows, "12").map((x) => x.id)).toEqual([]); // fewer than 3 digits: not a phone search
    expect(filterCustomers(rows, "29abcde1234f1z5").map((x) => x.id)).toEqual(["1"]);
    expect(filterCustomers(rows, "").map((x) => x.id)).toEqual(["1", "2"]);
  });

  it("orders: bill number, customer name or mobile; branch, status, payment method, dates", () => {
    const o = (id: string, over: Partial<OrderSummary>) => ({ id, invoiceNumber: "B1-C1-00001", status: "COMPLETED", createdAt: "2026-11-10T10:00:00.000Z", branchId: "b1", customerName: "", customerPhone: "", paymentMethodIds: [], ...over }) as OrderSummary;
    const rows = [
      o("1", { invoiceNumber: "B1-C1-00042", customerName: "Meera", customerPhone: "9876543210", paymentMethodIds: ["upi"] }),
      o("2", { invoiceNumber: "B2-C1-00007", branchId: "b2", status: "CANCELLED", createdAt: "2026-10-01T10:00:00.000Z", paymentMethodIds: ["cash"] }),
    ];
    const f = (over: Partial<Parameters<typeof filterOrders>[1]>) => filterOrders(rows, { branchId: "", q: "", status: "", methodId: "", from: null, to: null, ...over }).map((x) => x.id);
    expect(f({ q: "c1-00042" })).toEqual(["1"]);
    expect(f({ q: "mee" })).toEqual(["1"]);
    expect(f({ q: "98765" })).toEqual(["1"]);
    expect(f({ branchId: "b2" })).toEqual(["2"]);
    expect(f({ status: "CANCELLED" })).toEqual(["2"]);
    expect(f({ methodId: "upi" })).toEqual(["1"]);
    expect(f({ from: "2026-11-01T00:00:00.000Z" })).toEqual(["1"]);
    expect(f({ to: "2026-11-01T00:00:00.000Z" })).toEqual(["2"]);
  });
});
