// Money is in minor units (paise, cents: 1/100 of the currency), quantity is
// milli-units; these only format and parse. The business currency is set once
// the settings load (setMoneyCurrency), so amounts show in the shop's currency.

let moneyCurrency = "INR";

/** The business currency (ISO 4217), e.g. INR, AED, USD. */
export function setMoneyCurrency(currency: string | null | undefined) {
  if (currency) moneyCurrency = currency.toUpperCase();
}
export const getMoneyCurrency = () => moneyCurrency;

export function formatMoney(paise: number, currency = moneyCurrency): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", { style: "currency", currency, minimumFractionDigits: 2 }).format(paise / 100);
  } catch {
    return (paise / 100).toFixed(2);
  }
}

/** The shop currency's sign, e.g. ₹, AED, $ (for field labels). */
export function currencySign(currency = moneyCurrency): string {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" }).formatToParts(0).find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

/** The amount without a currency sign, e.g. 1,234.50 (for messages and receipts). */
export function formatAmount(paise: number, currency = moneyCurrency): string {
  return (paise / 100).toLocaleString(currency === "INR" ? "en-IN" : "en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1,234.50" (a currency sign or code in front is fine) → 123450; null when it isn't an amount. */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[,\s]/g, "").replace(/^(?:[A-Za-z]{3}|[^\d.A-Za-z]{1,3})(?=[\d.])/, "");
  if (!/^\d+(\.\d{0,2})?$/.test(t)) return null;
  const [r, p = ""] = t.split(".");
  return Number(r) * 100 + Number((p + "00").slice(0, 2));
}

export const paiseToInput = (paise: number | null | undefined) => (paise === null || paise === undefined ? "" : (paise / 100).toFixed(2).replace(/\.00$/, ""));

/** 1500 → "1.5"; 2000 → "2". */
export function formatQty(milli: number): string {
  return (milli / 1000).toLocaleString("en-IN", { maximumFractionDigits: 3 });
}

export function parseQty(text: string): number | null {
  const t = text.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{0,3})?$/.test(t)) return null;
  const [w, f = ""] = t.split(".");
  return Number(w) * 1000 + Number((f + "000").slice(0, 3));
}

export const bpToPercent = (bp: number) => (bp / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const tens = r < 20 ? ONES[r]! : `${TENS[Math.floor(r / 10)]}${r % 10 ? `-${ONES[r % 10]}` : ""}`;
  return [h ? `${ONES[h]} Hundred` : "", tens].filter(Boolean).join(" ");
}

/**
 * The amount in words for receipts. INR: Indian numbering, "Rupees One Lakh …
 * and Fifty Paise Only". Other currencies: millions and billions with the
 * currency's name, "One Thousand Two Hundred United Arab Emirates Dirhams and 50/100 Only".
 */
export function amountInWords(paise: number, currency = moneyCurrency): string {
  return currency === "INR" ? indianWords(paise) : internationalWords(paise, currency);
}

function currencyName(currency: string): string {
  try {
    const name = new Intl.DisplayNames(["en"], { type: "currency" }).of(currency) ?? currency;
    return name.endsWith("s") ? name : `${name}s`;
  } catch {
    return currency;
  }
}

function internationalWords(minor: number, currency: string): string {
  const whole = Math.floor(minor / 100);
  const cents = minor % 100;
  const parts: string[] = [];
  let n = whole;
  for (const [size, word] of [
    [1_000_000_000_000, "Trillion"],
    [1_000_000_000, "Billion"],
    [1_000_000, "Million"],
    [1_000, "Thousand"],
  ] as const) {
    const k = Math.floor(n / size);
    n %= size;
    if (k) parts.push(`${below1000(k)} ${word}`);
  }
  if (n) parts.push(below1000(n));
  const words = parts.join(" ") || "Zero";
  return `${words} ${currencyName(currency)}${cents ? ` and ${String(cents).padStart(2, "0")}/100` : ""} Only`;
}

function indianWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const p = paise % 100;
  const parts: string[] = [];
  let n = rupees;
  const crore = Math.floor(n / 1_00_00_000);
  n %= 1_00_00_000;
  const lakh = Math.floor(n / 1_00_000);
  n %= 1_00_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? indianWords(crore * 100).replace(/^Rupees | Only$/g, "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${p ? ` and ${below1000(p)} Paise` : ""} Only`;
}
