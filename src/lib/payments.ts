// Split payments and the UPI QR amount (same rules as the free Browser POS).
// Money is in paise. Pure functions, shared by billing and receipts.
import type { Order, PaymentMethod, Settings } from "./api";

/** The method that shows a UPI QR: kind UPI, or named "UPI", "UPI / GPay"… */
export function isUpiMethod(m: Pick<PaymentMethod, "name" | "kind"> | null | undefined): boolean {
  return !!m && (m.kind === "UPI" || /\bupi\b/i.test(m.name));
}

/** Format check for a UPI ID (handle@psp). Same rule as the API. */
export function looksLikeUpiId(upiId: string | null | undefined): boolean {
  return !!upiId && /^[a-z0-9._-]{2,256}@[a-z][a-z0-9.-]{1,63}$/i.test(upiId.trim());
}

/** upi://pay link for an exact amount, or "" when UPI can't be offered. */
export function upiPaymentLink(opts: { upiId: string | null | undefined; amount: number; businessName?: string; note?: string; currency?: string }): string {
  if (!looksLikeUpiId(opts.upiId) || (opts.currency ?? "INR") !== "INR" || !(opts.amount > 0)) return "";
  const p = new URLSearchParams();
  p.set("pa", opts.upiId!.trim().toLowerCase());
  if (opts.businessName) p.set("pn", opts.businessName);
  p.set("am", (opts.amount / 100).toFixed(2));
  p.set("cu", "INR");
  p.set("tn", opts.note || "Payment");
  return `upi://pay?${p.toString()}`;
}

export type SplitPart = { methodId: string; amount: number };
export type SplitCheck = { paid: number; remaining: number; ok: boolean; error: string };

const rupees = (paise: number) => (paise / 100).toFixed(2);

/** Validate split parts against the bill total. */
export function checkSplit(parts: SplitPart[], total: number, methods: Pick<PaymentMethod, "id">[]): SplitCheck {
  const paid = parts.reduce((sum, p) => sum + (Number.isFinite(p.amount) ? p.amount : 0), 0);
  const remaining = total - paid;
  const fail = (error: string): SplitCheck => ({ paid, remaining, ok: false, error });
  if (parts.length < 2) return fail("Add at least two payment methods to split.");
  // Overpaid first. On the billing screen the balance line then goes below zero.
  const over = Math.max(0, -remaining) + parts.reduce((sum, p) => sum + (p.amount < 0 ? -p.amount : 0), 0);
  if (over > 0) return fail(`Parts add up to ₹${rupees(over)} more than the total.`);
  for (const p of parts) {
    if (!methods.some((m) => m.id === p.methodId)) return fail("Pick a payment method for every part.");
    if (!Number.isFinite(p.amount) || p.amount <= 0) return fail("Every part needs an amount greater than zero.");
  }
  if (remaining > 0) return fail(`₹${rupees(remaining)} is still due.`);
  return { paid, remaining: 0, ok: true, error: "" };
}

/** Merge parts that use the same method, in entry order. */
export function mergeParts(parts: SplitPart[]): SplitPart[] {
  const out: SplitPart[] = [];
  for (const p of parts) {
    const same = out.find((o) => o.methodId === p.methodId);
    if (same) same.amount += p.amount;
    else out.push({ ...p });
  }
  return out;
}

/** What a receipt's UPI QR asks for: the UPI share, plus any udhaar (to pay later). 0 for cash/card. */
export function upiAmountForOrder(order: Pick<Order, "status" | "payments">): number {
  if (order.status !== "COMPLETED") return 0;
  return order.payments.filter((p) => p.kind === "CREDIT" || isUpiMethod({ name: p.methodName, kind: p.kind })).reduce((s, p) => s + p.amount, 0);
}

/** Whether this order's receipt can carry a UPI QR, and for how much. */
export function receiptUpi(order: Pick<Order, "status" | "payments" | "invoiceNumber">, settings: Pick<Settings, "upiId" | "business">): { amount: number; link: string } {
  const amount = upiAmountForOrder(order);
  const link = upiPaymentLink({ upiId: settings.upiId, amount, businessName: settings.business.name, note: `Bill ${order.invoiceNumber}`, currency: settings.business.currency });
  return { amount, link };
}
