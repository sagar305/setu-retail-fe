import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { OfflineShell } from "./components/OfflineShell";
import { OfflineSignIn } from "./pages/auth/OfflineSignIn";
import { CounterBillsPage } from "./pages/CounterBills";
import { PinPage } from "./pages/Pin";
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
import { ConnectedToolsPage } from "./pages/ConnectedTools";
import { ToolsHubPage } from "./pages/tools/ToolsHub";
import { CustomerLedgerPage, CustomerStatementPage } from "./pages/tools/CustomerLedger";
import { SupplierBookPage, SupplierLedgerPage, SupplierStatementPage } from "./pages/tools/Suppliers";
import { ExpensesPage } from "./pages/tools/Expenses";
import { CashBookPage } from "./pages/tools/CashBook";
import { NewPurchasePage, PurchaseDetailPage, PurchasesPage } from "./pages/tools/Purchases";
import { RequireTool } from "./pages/tools/RequireTool";
import { OfflineMoneyPage } from "./pages/OfflineMoney";
import { TransfersPage } from "./pages/Transfers";
import { BranchReportsPage } from "./pages/BranchReports";
import { AuditLogPage } from "./pages/AuditLog";
import { AgingPage } from "./pages/tools/Aging";
import { ProfitPage } from "./pages/tools/Profit";
import { StockRegisterPage } from "./pages/tools/StockRegister";
import { BarcodesPage } from "./pages/tools/Barcodes";
import { ReceiptDesignerPage } from "./pages/tools/ReceiptDesigner";

const BUILT = new Set(["/stock-transfers", "/branch-reports", "/audit-log", "/tools", "/branches", "/staff", "/settings/plan", "/billing", "/products", "/orders", "/customers", "/dashboard", "/reports"]);

export function App() {
  const { state } = useAuth();
  // No internet: PIN sign-in, then billing only.
  if (state.status === "offlineSignIn") return <OfflineSignIn />;
  if (state.status === "offline") {
    return (
      <Routes>
        <Route element={<OfflineShell />}>
          <Route path="/billing" element={<BillingPage />} />
          <Route path="/counter-bills" element={<CounterBillsPage />} />
          <Route path="/money" element={<OfflineMoneyPage />} />
          <Route path="*" element={<Navigate to="/billing" replace />} />
        </Route>
      </Routes>
    );
  }
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
            <Route path="/stock-transfers" element={<TransfersPage />} />
            <Route path="/branch-reports" element={<BranchReportsPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER", "MANAGER", "CASHIER"]} />}>
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/counter-bills" element={<CounterBillsPage />} />
            <Route path="/tools" element={<ToolsHubPage />} />
            <Route path="/money" element={<OfflineMoneyPage />} />
            <Route element={<RequireTool slug="customer-ledger" />}>
              <Route path="/tools/customer-ledger" element={<CustomerLedgerPage />} />
              <Route path="/tools/customer-ledger/:id" element={<CustomerStatementPage />} />
            </Route>
          </Route>
          <Route element={<Allow roles={["OWNER", "MANAGER"]} />}>
            <Route element={<RequireTool slug="supplier-book" />}>
              <Route path="/tools/suppliers" element={<SupplierBookPage />} />
            </Route>
            <Route element={<RequireTool slug="supplier-ledger" />}>
              <Route path="/tools/supplier-ledger" element={<SupplierLedgerPage />} />
              <Route path="/tools/supplier-ledger/:id" element={<SupplierStatementPage />} />
            </Route>
            <Route element={<RequireTool slug="expense-tracker" />}>
              <Route path="/tools/expenses" element={<ExpensesPage />} />
            </Route>
            <Route element={<RequireTool slug="cash-book" />}>
              <Route path="/tools/cash-book" element={<CashBookPage />} />
            </Route>
            <Route element={<RequireTool slug="invoice-aging" />}>
              <Route path="/tools/invoice-aging" element={<AgingPage kind="customers" />} />
            </Route>
            <Route element={<RequireTool slug="payables-aging" />}>
              <Route path="/tools/payables-aging" element={<AgingPage kind="suppliers" />} />
            </Route>
            <Route element={<RequireTool slug="profit-dashboard" />}>
              <Route path="/tools/profit" element={<ProfitPage />} />
            </Route>
            <Route element={<RequireTool slug="stock-register" />}>
              <Route path="/tools/stock-register" element={<StockRegisterPage />} />
            </Route>
            <Route element={<RequireTool slug="barcode-generator" />}>
              <Route path="/tools/barcodes" element={<BarcodesPage />} />
            </Route>
            <Route element={<RequireTool slug="receipt-designer" />}>
              <Route path="/tools/receipt-designer" element={<ReceiptDesignerPage />} />
            </Route>
            <Route element={<RequireTool slug="purchase-register" />}>
              <Route path="/tools/purchases" element={<PurchasesPage />} />
              <Route path="/tools/purchases/new" element={<NewPurchasePage />} />
              <Route path="/tools/purchases/:id" element={<PurchaseDetailPage />} />
            </Route>
          </Route>
          <Route element={<Allow roles={["OWNER", "MANAGER", "CASHIER"]} whenExpired />}>
            <Route path="/pin" element={<PinPage />} />
          </Route>
          <Route element={<Allow roles={["OWNER"]} />}>
            <Route path="/settings/pos" element={<PosSettingsPage />} />
            <Route path="/settings/tools" element={<ConnectedToolsPage />} />
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
