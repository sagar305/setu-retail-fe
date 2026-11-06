// Plain-language lines for audit log entries.
import type { AuditEntry } from "./api";
import { formatMoney, formatQty } from "./money";

type D = Record<string, unknown>;
const money = (v: unknown) => (typeof v === "number" ? formatMoney(v) : "");
const str = (v: unknown) => (v === null || v === undefined || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));
const FIELD: Record<string, string> = { price: "price", costPrice: "cost", name: "name", gstRateBp: "GST rate", hsn: "HSN", sku: "SKU", barcode: "barcode", phone: "phone", gstin: "GSTIN", stateCode: "state", creditDays: "credit days", lowStockMilli: "low-stock mark", unit: "unit" };
const MONEY_FIELDS = new Set(["price", "costPrice"]);

function changeLines(d: D): string[] {
  const c = d.changes as Record<string, [unknown, unknown]> | undefined;
  if (!c) return [];
  return Object.entries(c).map(([k, [a, b]]) => `${FIELD[k] ?? k}: ${MONEY_FIELDS.has(k) ? money(a) : str(a)} → ${MONEY_FIELDS.has(k) ? money(b) : str(b)}`);
}

const TITLES: Record<string, string> = {
  "auth.signed_in": "Signed in",
  "auth.sign_in_failed": "Wrong password",
  "account.created": "Account created",
  "trial.started": "Free trial started",
  "license.redeemed": "Key redeemed",
  "review.resolved": "Change picked in Needs review",
  "license.days_added": "Free days added by Setu",
  "account.locked_by_setu": "Account locked by Setu",
  "account.unlocked_by_setu": "Account unlocked by Setu",
  "plan.keep_active_chosen": "Chose what stays active",
  "staff.invited": "Staff invited",
  "staff.updated": "Staff changed",
  "user.invite_accepted": "Invite accepted",
  "user.password_reset": "Password reset",
  "user.pin_set": "Counter PIN set",
  "user.pin_removed": "Counter PIN removed",
  "branch.created": "Branch added",
  "branch.updated": "Branch changed",
  "counter.created": "Counter added",
  "counter.device_key": "Counter device key renewed",
  "settings.updated": "Settings changed",
  "product.created": "Product added",
  "product.updated": "Product changed",
  "product.price_changed": "Price changed",
  "product.branch_price": "Branch price set",
  "product.archived": "Product removed",
  "product.stock_adjusted": "Stock adjusted",
  "product.barcodes_generated": "Barcodes made",
  "customer.updated": "Customer changed",
  "supplier.created": "Supplier added",
  "supplier.updated": "Supplier changed",
  "supplier.archived": "Supplier removed",
  "order.cancelled": "Bill cancelled",
  "order.returned": "Goods returned (credit note)",
  "ledger.customer_payment": "Payment received",
  "ledger.supplier_payment": "Payment made",
  "ledger.customer_opening": "Customer opening balance",
  "ledger.supplier_opening": "Supplier opening balance",
  "ledger.customer_entry_voided": "Customer entry undone",
  "ledger.supplier_entry_voided": "Supplier entry undone",
  "expense.created": "Expense added",
  "expense.updated": "Expense changed",
  "expense.deleted": "Expense deleted",
  "cash_book.entry_added": "Cash in/out added",
  "cash_book.entry_deleted": "Cash line deleted",
  "cash_book.opening_set": "Opening cash set",
  "purchase.created": "Supplier bill entered",
  "purchase.cancelled": "Supplier bill cancelled",
  "purchase.returned": "Goods returned to supplier",
  "receipt_design.created": "Receipt design added",
  "receipt_design.updated": "Receipt design changed",
  "receipt_design.default": "Default receipt design",
  "receipt_design.deleted": "Receipt design deleted",
  "receipt_design.branch": "Branch receipt design",
  "transfer.sent": "Stock sent",
  "transfer.received": "Stock received",
  "transfer.cancelled": "Transfer cancelled",
  "import.products": "Products imported",
  "import.customers": "Customers imported",
  "import.free_pos": "Free POS backup imported",
  "sync.orders": "Offline bills synced",
  "sync.customers": "Offline customers synced",
  "sync.money": "Offline payments/expenses synced",
};
const WARN = new Set(["auth.sign_in_failed", "order.cancelled", "product.archived", "expense.deleted", "cash_book.entry_deleted", "ledger.customer_entry_voided", "ledger.supplier_entry_voided", "purchase.cancelled", "transfer.cancelled", "product.stock_adjusted"]);

/** "Chrome on Android" from a browser's user agent. */
export function deviceName(ua: string): string {
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "A browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iPhone/iPad" : /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} on ${os}` : browser;
}

export function describeAudit(e: AuditEntry): { title: string; details: string[]; tone?: "warn" } {
  const d = (e.data ?? {}) as D;
  const title = TITLES[e.action] ?? e.action.replace(/[._]/g, " ");
  const details: string[] = [];
  switch (e.action) {
    case "product.price_changed":
      details.push(`${str(d.name)}: ${money(d.from)} → ${money(d.to)}`);
      break;
    case "product.stock_adjusted":
      details.push(`${str(d.name)}: ${d.type === "SET" ? "counted" : d.type === "ADD" ? "+" : "−"}${formatQty(Number(d.qtyMilli))}, now ${formatQty(Number(d.stockAfterMilli))}${d.note ? ` (${str(d.note)})` : ""}`);
      break;
    case "order.cancelled":
      details.push(`${str(d.invoiceNumber)} · ${money(d.total)}${d.reason ? ` · “${str(d.reason)}”` : ""}`);
      break;
    case "order.returned":
      details.push(`${str(d.creditNote)} on ${str(d.invoiceNumber)} · ${money(d.total)}${d.reason ? ` · “${str(d.reason)}”` : ""}`);
      break;
    case "ledger.customer_payment":
    case "ledger.supplier_payment":
      details.push(`${str(d.name)} · ${money(d.amount)} by ${str(d.method)}`);
      break;
    case "expense.created":
      details.push(`${str(d.category)} · ${money(d.amount)} by ${str(d.method)}`);
      break;
    case "transfer.sent":
      details.push(`${str(d.number)} · ${str(d.from)} → ${str(d.to)} · ${str(d.items)} products · ${money(d.value)}`);
      break;
    case "transfer.received": {
      const short = (d.short as { name: string; returnedMilli: number; writtenOffMilli: number }[] | undefined) ?? [];
      details.push(`${str(d.number)}${short.length ? "" : " · all arrived"}`);
      for (const s of short) details.push(`${s.name}: ${s.returnedMilli ? `${formatQty(s.returnedMilli)} back to sender` : ""}${s.returnedMilli && s.writtenOffMilli ? ", " : ""}${s.writtenOffMilli ? `${formatQty(s.writtenOffMilli)} written off` : ""}`);
      break;
    }
    case "auth.sign_in_failed":
      details.push(d.locked ? "Too many tries: locked for 15 minutes" : `Attempt ${str(d.attempt)}`);
      break;
    case "auth.signed_in":
      if (d.userAgent) details.push(deviceName(String(d.userAgent)));
      break;
    case "license.days_added":
      details.push(`${str(d.days)} days of ${str(d.plan)}`);
      break;
    case "account.locked_by_setu":
      details.push("Contact Setu support");
      return { title, details, tone: "warn" };
    default: {
      const lines = changeLines(d);
      if (d.name && !lines.length) details.push(String(d.name));
      if (lines.length) details.push(...(d.name ? [`${String(d.name)}: ${lines[0]}`, ...lines.slice(1)] : lines));
      else
        for (const [k, v] of Object.entries(d)) {
          if (k === "name" || v === null || v === undefined || typeof v === "object") continue;
          details.push(`${k}: ${["amount", "total", "price", "value"].includes(k) ? money(v) : str(v)}`);
        }
    }
  }
  return { title, details, tone: WARN.has(e.action) ? "warn" : undefined };
}
