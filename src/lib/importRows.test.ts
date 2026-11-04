import { describe, expect, it } from "vitest";
import { csvRecords } from "./csv";
import { toCustomerRow, toProductRow } from "./importRows";

describe("CSV import rows", () => {
  it("reads a free POS Products.csv export", () => {
    const csv = "Name,SKU,Barcode,Category,Selling Price,Cost Price,Tax %,Tax Type,Stock,Low Stock Alert,Unit,Description\r\nTea 250 g,T1,890,Beverages,145,121,5,inclusive,10,3,pcs,\r\nSoap,,,,40.5,,18,exclusive,,,pcs,";
    const [tea, soap] = csvRecords(csv).records.map(toProductRow);
    expect(tea!.row).toMatchObject({ name: "Tea 250 g", sku: "T1", category: "Beverages", price: 14500, costPrice: 12100, gstRateBp: 500, taxInclusive: true, stockMilli: 10000, lowStockMilli: 3000, unit: "pcs" });
    expect(soap!.row).toMatchObject({ price: 4050, gstRateBp: 1800, taxInclusive: false });
    expect(soap!.row).not.toHaveProperty("stockMilli", expect.anything());
  });

  it("explains rows it can't read", () => {
    expect(toProductRow({ name: "", sellingprice: "10" }).error).toBe("Name is empty");
    expect(toProductRow({ name: "X", sellingprice: "abc" }).error).toMatch(/isn't a number/);
    expect(toProductRow({ name: "X", price: "10", stock: "-2" }).row).toMatchObject({ stockMilli: -2000 });
  });

  it("customers", () => {
    expect(toCustomerRow({ name: "Meera", phone: "99000 11111", gstin: "27ABCDE1234F1Z5" }).row).toMatchObject({ name: "Meera", phone: "99000 11111", gstin: "27ABCDE1234F1Z5" });
  });
});
