import { Navigate, Route, Routes } from "react-router-dom";
import { Allow, HomeRedirect, PublicOnly, RequireAuth } from "./auth/guards";
import { AppShell } from "./components/AppShell";
import { NAV_ITEMS } from "./lib/nav";
import { AcceptInvite } from "./pages/auth/AcceptInvite";
import { CheckEmail } from "./pages/auth/CheckEmail";
import { ForgotPassword } from "./pages/auth/ForgotPassword";
import { ResetPassword } from "./pages/auth/ResetPassword";
import { SignIn } from "./pages/auth/SignIn";
import { SignUp } from "./pages/auth/SignUp";
import { VerifyEmail } from "./pages/auth/VerifyEmail";
import { BranchesPage } from "./pages/Branches";
import { ComingSoon } from "./pages/ComingSoon";
import { KeepActivePage } from "./pages/KeepActive";
import { NotFound } from "./pages/NotFound";
import { PlanPage } from "./pages/PlanPage";
import { StaffPage } from "./pages/Staff";
import { BillingPage } from "./pages/Billing";
import { CustomersPage } from "./pages/Customers";
import { OrdersPage } from "./pages/Orders";
import { PosSettingsPage } from "./pages/PosSettings";
import { ProductsPage } from "./pages/Products";
import { DashboardPage } from "./pages/Dashboard";
import { ImportPage } from "./pages/Import";
import { ReportsPage } from "./pages/Reports";

const BUILT = new Set(["/branches", "/staff", "/settings/plan", "/billing", "/products", "/orders", "/customers", "/dashboard", "/reports"]);

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route element={<PublicOnly />}>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/sign-up" element={<SignUp />} />
        <Route path="/check-email" element={<CheckEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>
      {/* Links from emails work whether or not someone is signed in on this device. */}
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accept-invite" element={<AcceptInvite />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          {NAV_ITEMS.filter((item) => !BUILT.has(item.path)).map((item) => (
            <Route key={item.path} element={<Allow roles={item.roles} />}>
              <Route path={item.path} element={<ComingSoon />} />
            </Route>
          ))}
          <Route element={<Allow roles={["OWNER"]} />}>
            <Route path="/branches" element={<BranchesPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER", "MANAGER"]} />}>
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings/import" element={<ImportPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER", "MANAGER", "CASHIER"]} />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER"]} />}>
            <Route path="/settings/pos" element={<PosSettingsPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER"]} whenExpired />}>
            <Route path="/settings" element={<Navigate to="/settings/plan" replace />} />
            <Route path="/settings/plan" element={<PlanPage />} />
            <Route path="/keep-active" element={<KeepActivePage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
