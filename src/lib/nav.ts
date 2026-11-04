import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  LayoutDashboard,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Package,
  ScrollText,
  Settings,
  ShoppingCart,
  UserCog,
  Users,
} from "lucide-react";
import type { Me } from "./api";
import type { Role } from "./roles";

export type NavItem = {
  path: string;
  label: string;
  icon: LucideIcon;
  /** Roles that see this item. The API enforces the same rules. */
  roles: readonly Role[];
  /** Build phase that delivers the screen (docs/PLAN.md §10). */
  phase: number;
};

const ALL: readonly Role[] = ["OWNER", "MANAGER", "CASHIER"];
const OM: readonly Role[] = ["OWNER", "MANAGER"];
const O: readonly Role[] = ["OWNER"];

export const NAV_ITEMS: readonly NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: OM, phase: 2 },
  { path: "/billing", label: "Billing", icon: ShoppingCart, roles: ALL, phase: 2 },
  { path: "/products", label: "Products", icon: Package, roles: OM, phase: 2 },
  { path: "/orders", label: "Orders", icon: ListChecks, roles: ALL, phase: 2 },
  { path: "/customers", label: "Customers", icon: Users, roles: ALL, phase: 2 },
  { path: "/reports", label: "Reports", icon: BarChart3, roles: OM, phase: 2 },
  { path: "/tools", label: "Tools", icon: LayoutGrid, roles: ALL, phase: 4 },
  { path: "/stock-transfers", label: "Stock transfers", icon: ArrowLeftRight, roles: OM, phase: 5 },
  { path: "/branches", label: "Branches", icon: Building2, roles: O, phase: 1 },
  { path: "/staff", label: "Staff", icon: UserCog, roles: OM, phase: 1 },
  { path: "/audit-log", label: "Audit log", icon: ScrollText, roles: OM, phase: 5 },
  { path: "/settings/plan", label: "Settings", icon: Settings, roles: O, phase: 1 },
];

/** Cashiers see their own sales, so "Orders" reads differently for them. */
export function navForRole(role: Role): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) =>
    role === "CASHIER" && item.path === "/orders" ? { ...item, label: "My sales" } : item,
  );
}

export function homePathFor(role: Role): string {
  return role === "CASHIER" ? "/billing" : "/dashboard";
}

/** Where to land after sign-in: an owner whose plan ended goes straight to renewal. */
export function homePathForMe(me: Me): string {
  if (me.user.role === "OWNER" && me.plan.expired) return "/settings/plan";
  if (me.user.role === "OWNER" && me.account.keepActiveReviewPending) return "/keep-active";
  return homePathFor(me.user.role);
}
