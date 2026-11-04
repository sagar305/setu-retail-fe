// The 12 connected tools: who can use them, which work offline, and which are
// built yet. The owner switches each on or off in Settings → Connected tools;
// the API checks the same switches.
import type { Role } from "./roles";

export type ToolSlug =
  | "receipt-designer"
  | "customer-ledger"
  | "cash-book"
  | "invoice-aging"
  | "expense-tracker"
  | "purchase-register"
  | "supplier-book"
  | "supplier-ledger"
  | "payables-aging"
  | "profit-dashboard"
  | "stock-register"
  | "barcode-generator";

export type Tool = {
  slug: ToolSlug;
  name: string;
  group: "Sales & billing" | "Money in" | "Money out" | "Reports & analysis";
  description: string;
  /** Who can open it. */
  roles: readonly Role[];
  who: string;
  offline: boolean;
  /** Screen path, or null while it's still being built (Phase 4b). */
  path: string | null;
  /** What switching it off changes, if more than hiding it. */
  unlocks?: string;
};

const ALL: readonly Role[] = ["OWNER", "MANAGER", "CASHIER"];
const OM: readonly Role[] = ["OWNER", "MANAGER"];

export const TOOLS: readonly Tool[] = [
  { slug: "receipt-designer", name: "Receipt Designer", group: "Sales & billing", description: "Design the receipt; saved designs print from billing.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/receipt-designer" },
  { slug: "customer-ledger", name: "Customer Ledger (Udhaar)", group: "Money in", description: "Credit sales post here; record payments received.", roles: ALL, who: "Everyone can receive payments", offline: true, path: "/tools/customer-ledger", unlocks: "Udhaar at checkout" },
  { slug: "cash-book", name: "Cash Book", group: "Money in", description: "Daily cash in and out, opening and closing balance, per branch.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/cash-book" },
  { slug: "invoice-aging", name: "Invoice Aging", group: "Money in", description: "Who owes you, how much, how overdue.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/invoice-aging" },
  { slug: "expense-tracker", name: "Expense Tracker", group: "Money out", description: "Record shop spending by category.", roles: OM, who: "Owner and manager", offline: true, path: "/tools/expenses" },
  { slug: "purchase-register", name: "Purchase Register", group: "Money out", description: "Supplier bills that top up stock, with input GST.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/purchases" },
  { slug: "supplier-book", name: "Supplier Book", group: "Money out", description: "Supplier contacts and GSTINs.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/suppliers" },
  { slug: "supplier-ledger", name: "Supplier Ledger", group: "Money out", description: "What you owe each supplier; record payments made.", roles: OM, who: "Owner and manager", offline: true, path: "/tools/supplier-ledger" },
  { slug: "payables-aging", name: "Payables Aging", group: "Money out", description: "Unpaid supplier bills by due date.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/payables-aging" },
  { slug: "profit-dashboard", name: "Profit Dashboard", group: "Reports & analysis", description: "Sales minus real expenses, by branch.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/profit" },
  { slug: "stock-register", name: "Stock Register", group: "Reports & analysis", description: "Stock levels and every movement, per branch.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/stock-register" },
  { slug: "barcode-generator", name: "Barcode Generator", group: "Reports & analysis", description: "Print scannable labels for your products.", roles: OM, who: "Owner and manager", offline: false, path: "/tools/barcodes" },
];

export const TOOL_GROUPS = ["Sales & billing", "Money in", "Money out", "Reports & analysis"] as const;

export const toolOn = (tools: Record<string, boolean> | undefined, slug: ToolSlug) => tools?.[slug] !== false;

/** Tools this person can open right now. */
export const toolsFor = (role: Role, tools: Record<string, boolean> | undefined) => TOOLS.filter((t) => t.roles.includes(role) && toolOn(tools, t.slug));

export const toolBySlug = (slug: ToolSlug) => TOOLS.find((t) => t.slug === slug)!;
