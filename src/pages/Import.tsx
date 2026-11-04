import { useState } from "react";
import { useMe } from "../auth/AuthProvider";
import { Alert, Button, Card, PageHeader, SelectField } from "../components/ui";
import { apiPost, type ImportResult } from "../lib/api";
import { currentBranch } from "../lib/branch";
import { csvRecords, downloadCsv, toCsv } from "../lib/csv";
import { errorMessage } from "../lib/format";
import { SettingsTabs } from "./SettingsTabs";

import { CUSTOMER_HEADERS, PRODUCT_HEADERS, toCustomerRow, toProductRow } from "../lib/importRows";

type Prepared = { rows: Record<string, unknown>[]; errors: { row: number; message: string }[]; file: string };

function prepare(text: string, file: string, map: typeof toProductRow): Prepared {
  const { records } = csvRecords(text);
  const rows: Record<string, unknown>[] = [];
  const errors: Prepared["errors"] = [];
  records.forEach((r, i) => {
    const out = map(r);
    if (out.row) rows.push(out.row);
    else errors.push({ row: i + 2, message: out.error! });
  });
  return { rows, errors, file };
}

function Results({ r }: { r: ImportResult & { note?: string } }) {
  return (
    <div className="flex flex-col gap-2">
      <Alert tone={r.errors.length ? "warn" : "ok"}>
        {r.created} added, {r.updated} updated{r.errors.length ? `, ${r.errors.length} skipped` : ""}.{r.note ? ` ${r.note}` : ""}
      </Alert>
      {r.errors.length ? (
        <ul className="m-0 max-h-48 list-none overflow-auto rounded-xl border border-line bg-white p-3 text-sm">
          {r.errors.slice(0, 200).map((e) => (
            <li key={`${e.row}-${e.message}`}>
              Row {e.row}: {e.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function CsvImport({ kind }: { kind: "products" | "customers" }) {
  const me = useMe();
  const usable = me.branches.filter((b) => b.withinPlan);
  const [branchId, setBranchId] = useState(currentBranch(me)?.id ?? "");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headers = kind === "products" ? PRODUCT_HEADERS : CUSTOMER_HEADERS;
  const title = kind === "products" ? "Products from CSV" : "Customers from CSV";

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">{title}</h2>
        <p className="m-0 text-sm text-muted">
          {kind === "products"
            ? "Columns: Name, Selling Price (₹) and optionally SKU, Barcode, Category, HSN, Cost Price, Tax %, Tax Type (inclusive/exclusive), Stock, Low Stock Alert, Unit. The free POS Products.csv works as is. Matching SKU, barcode or name updates the product; Stock sets this branch's stock."
            : "Columns: Name and optionally Phone, Email, GSTIN, State Code, Address, Notes. The free POS Customers.csv works as is. A matching mobile number updates the customer."}
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Button
          variant="ghost"
          onClick={() =>
            downloadCsv(
              kind === "products" ? "Products_template.csv" : "Customers_template.csv",
              toCsv(headers, [kind === "products" ? ["Wheat Atta 5 kg", "ATT-5", "8901234567890", "Staples", "1101", "285", "248", "5", "inclusive", "20", "5", "pcs"] : ["Meera Rao", "9900011111", "", "", "", "MG Road", ""]]),
            )
          }
        >
          Download template
        </Button>
        {kind === "products" && usable.length > 1 ? (
          <div className="min-w-[200px]">
            <SelectField label="Stock goes into" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {usable.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] border border-indigo bg-white px-4 text-sm font-semibold text-indigo">
          Choose CSV file
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setResult(null);
              setError(null);
              setPrepared(prepare(await f.text(), f.name, kind === "products" ? toProductRow : toCustomerRow));
            }}
          />
        </label>
      </div>
      {prepared ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm">
            <strong>{prepared.file}</strong>: {prepared.rows.length} row{prepared.rows.length === 1 ? "" : "s"} ready
            {prepared.errors.length ? `, ${prepared.errors.length} can't be read` : ""}.
          </p>
          {prepared.errors.length ? (
            <ul className="m-0 max-h-32 list-none overflow-auto rounded-xl border border-line bg-white p-3 text-sm">
              {prepared.errors.map((x) => (
                <li key={x.row}>
                  Row {x.row}: {x.message}
                </li>
              ))}
            </ul>
          ) : null}
          <Button
            busy={busy}
            disabled={!prepared.rows.length}
            className="self-start"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const r = await apiPost<ImportResult>(`/imports/${kind}`, kind === "products" ? { branchId, rows: prepared.rows } : { rows: prepared.rows });
                // Server row numbers count only the rows we sent; map back to file rows is approximate, so show them as sent.
                setResult({ ...r, errors: [...prepared.errors, ...r.errors.map((x) => ({ ...x, message: `(item ${x.row}) ${x.message}` }))] });
                setPrepared(null);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Import {prepared.rows.length} {kind}
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {result ? <Results r={result} /> : null}
    </Card>
  );
}

type BooksSummary = { suppliers: number; expenses: number; cashEntries: number; customerLedger: number; supplierLedger: number; purchases: number; purchaseReturns: number };
type FreePosSummary = { books: BooksSummary; products: ImportResult; customers: ImportResult; categories: number; paymentMethodsAdded: number; batches: number; skipped: { orders: number } };
const TOOL_STORES = ["suppliers", "expenses", "cashbook", "ledger", "supplier_ledger", "purchases", "purchase_returns"];

function FreePosImport() {
  const me = useMe();
  const usable = me.branches.filter((b) => b.withinPlan);
  const [branchId, setBranchId] = useState(currentBranch(me)?.id ?? "");
  const [backup, setBackup] = useState<{ file: string; data: { app: string; version: number; data: Record<string, unknown[]> } } | null>(null);
  const [summary, setSummary] = useState<FreePosSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = (k: string) => backup?.data.data[k]?.length ?? 0;

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-lg font-semibold">From the free Browser POS</h2>
        <p className="m-0 text-sm text-muted">
          In the free POS, open Settings → Backup and download <strong>POS_BACKUP.json</strong>, then choose it here. Products, categories, customers, payment methods and stock come in{" "}
          {"(and batches, if batch tracking is on here)"}, plus the connected tools' history: suppliers, purchases and returns, expenses, cash book, and udhaar and supplier ledgers. Old bills stay in the free POS. Importing again updates instead of duplicating.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {usable.length > 1 ? (
          <div className="min-w-[200px]">
            <SelectField label="Into branch" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
              {usable.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} ({b.code})
                </option>
              ))}
            </SelectField>
          </div>
        ) : null}
        <label className="flex min-h-11 cursor-pointer items-center rounded-[10px] border border-indigo bg-white px-4 text-sm font-semibold text-indigo">
          Choose POS_BACKUP.json
          <input
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              setSummary(null);
              setError(null);
              try {
                const parsed = JSON.parse(await f.text()) as { app?: string; version?: number; data?: Record<string, unknown[]> };
                if (parsed.app !== "setu-free-pos" || !parsed.data) throw new Error("not a backup");
                // Pictures make the file huge and aren't used here.
                const products = (parsed.data.products ?? []).map((p) => ({ ...(p as object), imageDataUrl: "" }));
                const keep = ["settings", "categories", "products", "customers", "payments", "stock_batches", "orders", ...TOOL_STORES];
                const data = Object.fromEntries(keep.map((k) => [k, k === "products" ? products : k === "orders" ? (parsed.data![k] ?? []).map(() => ({})) : (parsed.data![k] ?? [])]));
                setBackup({ file: f.name, data: { app: parsed.app, version: parsed.version ?? 1, data } });
              } catch {
                setBackup(null);
                setError("That file isn't a Setu Browser POS backup. In the free POS use Settings → Backup → Download backup.");
              }
            }}
          />
        </label>
      </div>
      {backup ? (
        <div className="flex flex-col gap-3">
          <p className="m-0 text-sm">
            <strong>{backup.file}</strong>: {count("products")} products, {count("categories")} categories, {count("customers")} customers, {count("payments")} payment methods
            {count("stock_batches") ? `, ${count("stock_batches")} batches` : ""}
            {TOOL_STORES.some((k) => count(k)) ? `; tools: ${count("suppliers")} suppliers, ${count("purchases")} supplier bills, ${count("expenses")} expenses, ${count("ledger")} udhaar entries, ${count("supplier_ledger")} supplier ledger entries, ${count("cashbook")} cash book lines` : ""}
            {count("orders") ? ` (${count("orders")} old bills stay in the free POS)` : ""}.
          </p>
          <Button
            busy={busy}
            className="self-start"
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                setSummary(await apiPost<FreePosSummary>("/imports/free-pos", { branchId, backup: backup.data }));
                setBackup(null);
              } catch (err) {
                setError(errorMessage(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            Import into {usable.find((b) => b.id === branchId)?.name ?? "branch"}
          </Button>
        </div>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {summary ? (
        <div className="flex flex-col gap-2">
          <Results r={{ ...summary.products, note: `Products. ${summary.categories} categories${summary.batches ? `, ${summary.batches} batches` : ""}.` }} />
          <Results r={{ ...summary.customers, note: `Customers. ${summary.paymentMethodsAdded} payment method${summary.paymentMethodsAdded === 1 ? "" : "s"} added.` }} />
          {summary.books ? (
            <Alert tone="ok">
              Tools: {summary.books.suppliers} suppliers added, {summary.books.purchases} supplier bills, {summary.books.purchaseReturns} returns, {summary.books.expenses} expenses, {summary.books.cashEntries} cash book lines, {summary.books.customerLedger} udhaar entries and {summary.books.supplierLedger} supplier ledger entries.
            </Alert>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

export function ImportPage() {
  const me = useMe();
  return (
    <div className="w-full">
      <PageHeader title={me.user.role === "OWNER" ? "Settings" : "Import"} description="Bring your products and customers in." />
      {me.user.role === "OWNER" ? <SettingsTabs /> : null}
      <div className="grid gap-5 xl:grid-cols-2">
        {me.user.role === "OWNER" ? (
          <div className="xl:col-span-2">
            <FreePosImport />
          </div>
        ) : null}
        <CsvImport kind="products" />
        <CsvImport kind="customers" />
      </div>
    </div>
  );
}
