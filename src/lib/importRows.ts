import { parseMoney, parseQty } from "./money";

// Headers: ours, plus the free Browser POS exports (Products.csv, Customers.csv).
export const PRODUCT_HEADERS = ["Name", "SKU", "Barcode", "Category", "HSN", "Selling Price", "Cost Price", "Tax %", "Tax Type", "Stock", "Low Stock Alert", "Unit"];
export const CUSTOMER_HEADERS = ["Name", "Phone", "Email", "GSTIN", "State Code", "Address", "Notes"];

const pick = (r: Record<string, string>, ...keys: string[]) => keys.map((k) => r[k]).find((v) => v !== undefined && v !== "");
const yes = (v?: string) => (v ? /^(y|yes|true|1|inclusive|incl)/i.test(v) : undefined);

/** One CSV record → an import row, or a reason it can't be read. */
export function toProductRow(r: Record<string, string>): { row?: Record<string, unknown>; error?: string } {
  const name = pick(r, "name", "productname", "item");
  const priceText = pick(r, "sellingprice", "price", "mrp", "rate");
  if (!name) return { error: "Name is empty" };
  const price = priceText ? parseMoney(priceText) : null;
  if (price === null) return { error: `Selling price "${priceText ?? ""}" isn't a number` };
  const cost = pick(r, "costprice", "cost");
  const tax = pick(r, "tax%", "tax", "gst%", "gst", "gstrate");
  const taxType = pick(r, "taxtype", "priceincludesgst", "inclusive");
  const stock = pick(r, "stock", "qty", "quantity");
  const low = pick(r, "lowstockalert", "lowstock");
  const costPaise = cost ? parseMoney(cost) : null;
  const taxBp = tax ? parseMoney(tax.replace("%", "")) : 0;
  const stockMilli = stock ? parseQty(stock.replace(/^-/, "")) : null;
  if (cost && costPaise === null) return { error: `Cost price "${cost}" isn't a number` };
  if (tax && taxBp === null) return { error: `Tax % "${tax}" isn't a number` };
  if (stock && stockMilli === null) return { error: `Stock "${stock}" isn't a number` };
  return {
    row: {
      name,
      sku: pick(r, "sku", "code") ?? "",
      barcode: pick(r, "barcode", "ean") ?? "",
      category: pick(r, "category") ?? undefined,
      hsn: pick(r, "hsn", "hsncode") ?? "",
      price,
      costPrice: costPaise,
      gstRateBp: taxBp ?? 0,
      taxInclusive: taxType === undefined ? true : (yes(taxType) ?? true) && !/exclusive|excl/i.test(taxType),
      unit: pick(r, "unit", "uom") ?? "pcs",
      trackStock: stock !== undefined ? true : undefined,
      stockMilli: stock !== undefined && stockMilli !== null ? (stock.startsWith("-") ? -stockMilli : stockMilli) : undefined,
      lowStockMilli: low ? parseQty(low) : undefined,
    },
  };
}

export function toCustomerRow(r: Record<string, string>): { row?: Record<string, unknown>; error?: string } {
  const name = pick(r, "name", "customername");
  if (!name) return { error: "Name is empty" };
  return { row: { name, phone: pick(r, "phone", "mobile") ?? "", email: pick(r, "email") ?? "", gstin: pick(r, "gstin", "gst") ?? "", stateCode: pick(r, "statecode", "state") ?? "", address: pick(r, "address") ?? "", notes: pick(r, "notes") ?? "" } };
}

