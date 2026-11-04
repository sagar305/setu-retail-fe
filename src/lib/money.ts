// Money is paise, quantity is milli-units; these only format and parse.

export function formatMoney(paise: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en", { style: "currency", currency, minimumFractionDigits: 2 }).format(paise / 100);
  } catch {
    return (paise / 100).toFixed(2);
  }
}

/** "1,234.50" → 123450; null when it isn't an amount. */
export function parseMoney(text: string): number | null {
  const t = text.replace(/[,₹\s]/g, "");
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

/** Indian numbering: 1,23,45,678.50 → "Rupees One Crore Twenty-Three Lakh … and Fifty Paise Only". */
export function amountInWords(paise: number): string {
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
  if (crore) parts.push(`${crore >= 1000 ? amountInWords(crore * 100).replace(/^Rupees | Only$/g, "") : below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  const words = parts.join(" ") || "Zero";
  return `Rupees ${words}${p ? ` and ${below1000(p)} Paise` : ""} Only`;
}
