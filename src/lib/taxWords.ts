// What the shop calls its tax things: India GST, or its own words (VAT, TRN,
// HS code…) in custom tax mode. Screens and receipts use these, never "GST"
// written into the code.
import type { Settings } from "./api";

export type TaxWords = {
  /** Custom tax mode: tax groups, no CGST/SGST/IGST, no state codes. */
  custom: boolean;
  /** "GST", "VAT", "Sales tax"… */
  tax: string;
  /** "GSTIN", "TRN", "VAT No"… */
  number: string;
  /** "HSN", "HS code"…; "" when hidden. */
  code: string;
  /** Receipt heading while tax is on: "TAX INVOICE"… */
  title: string;
};

type TaxSettings = Partial<Pick<Settings, "taxMode" | "taxLabel" | "taxNumberLabel" | "itemCodeLabel" | "invoiceTitle">>;

export function taxWordsFor(s: TaxSettings | null | undefined): TaxWords {
  const custom = s?.taxMode === "CUSTOM";
  return {
    custom,
    tax: s?.taxLabel?.trim() || (custom ? "Tax" : "GST"),
    number: s?.taxNumberLabel?.trim() || (custom ? "Tax number" : "GSTIN"),
    code: s?.itemCodeLabel === undefined ? "HSN" : s.itemCodeLabel.trim(),
    title: s?.invoiceTitle?.trim() || "TAX INVOICE",
  };
}

type Group = { id: string; taxes: { name: string; rateBp: number }[]; isDefault: boolean };

/**
 * A product's custom taxes, as the server works them out: its group, else the
 * default group, else none. Undefined in India GST mode (the GST rate is used).
 */
export function productTaxes(mode: string | undefined, taxGroupId: string | null | undefined, groups: readonly Group[] | undefined): { name: string; rateBp: number }[] | undefined {
  if (mode !== "CUSTOM") return undefined;
  const list = groups ?? [];
  const g = (taxGroupId ? list.find((x) => x.id === taxGroupId) : undefined) ?? list.find((x) => x.isDefault);
  return g ? g.taxes : [];
}

/** "VAT 5%" or "VAT 5% + Tourism fee 2%"; "No tax" for none. */
export function taxesLabel(taxes: readonly { name: string; rateBp: number }[]): string {
  if (!taxes.length) return "No tax";
  return taxes.map((t) => `${t.name} ${(t.rateBp / 100).toLocaleString("en", { maximumFractionDigits: 2 })}%`).join(" + ");
}
