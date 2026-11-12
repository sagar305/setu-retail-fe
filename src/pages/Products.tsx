import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useCacheRefresh } from "../hooks/useCacheRefresh";
import { useTaxWords } from "../hooks/useSettings";
import { useTaxGroups } from "../hooks/useTaxGroups";
import { currencySign } from "../lib/money";
import { productTaxes, taxesLabel, taxWordsFor } from "../lib/taxWords";
import { Link } from "react-router-dom";
import { useMe } from "../auth/AuthProvider";
import { Alert, Badge, Button, Field, Modal, PageHeader, SelectField } from "../components/ui";
import { ApiError, apiGet, apiPost, type Category, type Product } from "../lib/api";
import { newUuid, saveChange } from "../lib/changes";
import { currentBranch, rememberBranch } from "../lib/branch";
import { errorMessage } from "../lib/format";
import { bpToPercent, formatMoney, formatQty, paiseToInput, parseMoney, parseQty } from "../lib/money";
import { downloadCsv, toCsv } from "../lib/csv";
import { BatchesDialog } from "../pos/Batches";
import { fmtDay } from "../lib/batches";
import type { Settings } from "../lib/api";
import { Pagination } from "../components/Pagination";
import { usePageSize } from "../hooks/usePageSize";

const GST_RATES = [0, 25, 300, 500, 1200, 1800, 2800, 4000];
const UNITS = ["pcs", "kg", "g", "l", "ml", "m", "box", "pack", "dozen"];

type Draft = {
  name: string;
  categoryId: string;
  newCategory: string;
  sku: string;
  barcode: string;
  hsn: string;
  gstRateBp: number;
  /** Custom tax mode: "" = the default group. */
  taxGroupId: string;
  taxInclusive: boolean;
  unit: string;
  price: string;
  costPrice: string;
  trackStock: boolean;
  lowStock: string;
  openingStock: string;
};

const blank: Draft = { name: "", categoryId: "", newCategory: "", sku: "", barcode: "", hsn: "", gstRateBp: 0, taxGroupId: "", taxInclusive: true, unit: "pcs", price: "", costPrice: "", trackStock: true, lowStock: "", openingStock: "" };
const toDraft = (p: Product): Draft => ({
  name: p.name,
  categoryId: p.categoryId ?? "",
  newCategory: "",
  sku: p.sku,
  barcode: p.barcode,
  hsn: p.hsn,
  gstRateBp: p.gstRateBp,
  taxGroupId: p.taxGroupId ?? "",
  taxInclusive: p.taxInclusive,
  unit: p.unit,
  price: paiseToInput(p.defaultPrice),
  costPrice: paiseToInput(p.costPrice),
  trackStock: p.trackStock,
  lowStock: p.lowStockMilli === null ? "" : formatQty(p.lowStockMilli),
  openingStock: "",
});

function ProductForm({ product, categories, branchId, onDone, onClose }: { product: Product | null; categories: Category[]; branchId: string; onDone: () => void; onClose: () => void }) {
  const words = useTaxWords();
  const { groups } = useTaxGroups(words.custom);
  const dflt = groups.find((g) => g.isDefault);
  const [d, setD] = useState<Draft>(product ? toDraft(product) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    const price = parseMoney(d.price);
    const cost = d.costPrice ? parseMoney(d.costPrice) : null;
    const low = d.lowStock ? parseQty(d.lowStock) : null;
    const opening = d.openingStock ? parseQty(d.openingStock) : null;
    const bad: Record<string, string> = {};
    if (price === null) bad.price = "Enter a price, e.g. 285 or 14.50.";
    if (d.costPrice && cost === null) bad.costPrice = "Enter an amount.";
    if (d.lowStock && low === null) bad.lowStock = "Enter a quantity.";
    if (d.openingStock && opening === null) bad.openingStock = "Enter a quantity.";
    if (Object.keys(bad).length) return setErrors(bad);

    setBusy(true);
    setErrors({});
    setError(null);
    try {
      let categoryId: string | null = d.categoryId || null;
      if (d.newCategory.trim()) categoryId = (await apiPost<{ category: Category }>("/categories", { name: d.newCategory.trim() })).category.id;
      const body = {
        name: d.name,
        categoryId,
        sku: d.sku,
        barcode: d.barcode,
        hsn: d.hsn,
        gstRateBp: d.gstRateBp,
        ...(words.custom ? { taxGroupId: d.taxGroupId || null } : {}),
        taxInclusive: d.taxInclusive,
        unit: d.unit,
        price: price!,
        costPrice: cost,
        trackStock: d.trackStock,
        lowStockMilli: low,
      };
      // Saved on this device at once; the cloud gets it in the background (Phase 9b).
      if (product) {
        const before: Record<string, unknown> = { name: product.name, categoryId: product.categoryId, sku: product.sku, barcode: product.barcode, hsn: product.hsn, gstRateBp: product.gstRateBp, taxGroupId: product.taxGroupId, taxInclusive: product.taxInclusive, unit: product.unit, price: product.defaultPrice, costPrice: product.costPrice, trackStock: product.trackStock, lowStockMilli: product.lowStockMilli };
        const changed = Object.fromEntries(Object.entries(body).filter(([k, v]) => JSON.stringify(v ?? null) !== JSON.stringify(before[k] ?? null)));
        if (Object.keys(changed).length) {
          const base = Object.fromEntries(Object.keys(changed).map((k) => [k, before[k] ?? null]));
          const { price: newDefault, ...rest } = changed as { price?: number } & Record<string, unknown>;
          const shown = { ...rest, ...(newDefault !== undefined ? { defaultPrice: newDefault, ...(product.branchPrice === null ? { price: newDefault } : {}) } : {}) };
          await saveChange({ method: "PATCH", path: `/products/${product.id}`, body: changed, base, label: `${product.name}: details changed`, effects: [{ kind: "update", id: product.id, fields: shown }] });
        }
      } else {
        const id = newUuid();
        const qty = d.trackStock && opening ? opening : 0;
        const item = { ...body, id, defaultPrice: price!, branchPrice: null, stockMilli: qty, stockStatus: !d.trackStock ? "untracked" : qty <= 0 ? "out" : "ok", archived: false, nextExpiry: null, createdAt: new Date().toISOString() };
        await saveChange({ method: "POST", path: "/products", body: { ...body, id, openingStock: opening ? [{ branchId, qtyMilli: opening }] : [] }, label: `New product ${d.name}`, effects: [{ kind: "insert", into: "/products?", key: "products", item }] });
      }
      onDone();
    } catch (err) {
      if (err instanceof ApiError && err.code === "validation_error") setErrors(err.fieldErrors);
      else setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={product ? `Edit ${product.name}` : "New product"} onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Name" required value={d.name} onChange={set("name")} error={errors.name} className="md:col-span-2" />
          <Field label={`Selling price (${currencySign()})`} inputMode="decimal" required value={d.price} onChange={set("price")} error={errors.price} hint="Default for every branch; a branch can set its own." />
          <SelectField label={`Price includes ${words.tax}?`} value={d.taxInclusive ? "yes" : "no"} onChange={(e) => setD({ ...d, taxInclusive: e.target.value === "yes" })}>
            <option value="yes">Yes — {words.tax} is inside the price</option>
            <option value="no">No — add {words.tax} on top</option>
          </SelectField>
          {words.custom ? (
            <SelectField label="Tax group" value={d.taxGroupId} onChange={set("taxGroupId")} hint={groups.length ? "Which taxes this product pays." : "Add tax groups in Settings → Billing & receipt."}>
              <option value="">Default{dflt ? ` (${dflt.name}: ${taxesLabel(dflt.taxes)})` : ""}</option>
              {groups
                .filter((g) => !g.isDefault)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}: {taxesLabel(g.taxes)}
                  </option>
                ))}
            </SelectField>
          ) : (
            <SelectField label={`${words.tax} rate`} value={String(d.gstRateBp)} onChange={(e) => setD({ ...d, gstRateBp: Number(e.target.value) })}>
              {GST_RATES.map((r) => (
                <option key={r} value={r}>
                  {bpToPercent(r)}%
                </option>
              ))}
            </SelectField>
          )}
          {words.code ? (
            <Field
              label={`${words.code} code`.replace(/ code code$/i, " code")}
              inputMode={words.custom ? "text" : "numeric"}
              value={d.hsn}
              onChange={set("hsn")}
              error={errors.hsn}
              hint={words.custom ? "Optional; printed on bills." : "4, 6 or 8 digits; printed on GST bills."}
            />
          ) : null}
          <Field label={`Cost price (${currencySign()})`} inputMode="decimal" value={d.costPrice} onChange={set("costPrice")} error={errors.costPrice} hint="Only owners and managers see this." />
          <SelectField label="Unit" value={d.unit} onChange={set("unit")}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </SelectField>
          <SelectField label="Category" value={d.categoryId} onChange={set("categoryId")}>
            <option value="">None</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>
          <Field label="…or new category" value={d.newCategory} onChange={set("newCategory")} />
          <Field label="SKU" value={d.sku} onChange={set("sku")} />
          <Field label="Barcode" value={d.barcode} onChange={set("barcode")} hint="Scan it into this box." />
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" checked={d.trackStock} onChange={set("trackStock")} className="size-[18px] accent-indigo" />
          Track stock for this product
        </label>
        {d.trackStock ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={`Low stock at (${d.unit})`} inputMode="decimal" value={d.lowStock} onChange={set("lowStock")} error={errors.lowStock} hint="Blank = 5" />
            {!product ? <Field label={`Opening stock in this branch (${d.unit})`} inputMode="decimal" value={d.openingStock} onChange={set("openingStock")} error={errors.openingStock} /> : null}
          </div>
        ) : null}
        <div className="flex gap-3">
          <Button type="submit" busy={busy} disabled={!d.name.trim() || !d.price}>
            {product ? "Save" : "Add product"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function StockDialog({ product, branchId, onDone, onClose }: { product: Product; branchId: string; onDone: () => void; onClose: () => void }) {
  const [type, setType] = useState<"ADD" | "REDUCE" | "SET">("ADD");
  const [qty, setQty] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = parseQty(qty);
  return (
    <Modal title={`Stock: ${product.name}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm">
          Now: <strong>{formatQty(product.stockMilli)} {product.unit}</strong> in this branch
        </p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div role="group" aria-label="Change" className="grid grid-cols-3 gap-2">
          {(["ADD", "REDUCE", "SET"] as const).map((t) => (
            <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={`min-h-11 rounded-[10px] text-sm ${type === t ? "border-2 border-indigo bg-indigo-50 font-semibold text-indigo" : "border border-line"}`}>
              {t === "ADD" ? "Add" : t === "REDUCE" ? "Reduce" : "Set to"}
            </button>
          ))}
        </div>
        <Field label={`Quantity (${product.unit})`} inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} error={qty && parsed === null ? "Enter a quantity." : undefined} />
        <Field label="Note" placeholder="Delivery, damage, stock count…" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button
          busy={busy}
          disabled={parsed === null}
          onClick={async () => {
            setBusy(true);
            try {
              const now = type === "ADD" ? product.stockMilli + parsed! : type === "REDUCE" ? product.stockMilli - parsed! : parsed!;
              await saveChange({ method: "POST", path: `/products/${product.id}/stock`, body: { branchId, type, qtyMilli: parsed, note }, label: `Stock of ${product.name}: ${type === "ADD" ? "+" : type === "REDUCE" ? "−" : "set to "}${formatQty(parsed!)}`, effects: [{ kind: "update", id: product.id, fields: { stockMilli: now } }] });
              onDone();
            } catch (err) {
              setError(errorMessage(err));
              setBusy(false);
            }
          }}
        >
          Save stock
        </Button>
      </div>
    </Modal>
  );
}

function BranchPriceDialog({ product, branchName, branchId, onDone, onClose }: { product: Product; branchName: string; branchId: string; onDone: () => void; onClose: () => void }) {
  const [text, setText] = useState(paiseToInput(product.branchPrice));
  const [error, setError] = useState<string | null>(null);
  const parsed = text ? parseMoney(text) : null;
  const save = async (price: number | null) => {
    try {
      await saveChange({
        method: "PUT",
        path: `/products/${product.id}/branches/${branchId}`,
        body: { price },
        base: { price: product.branchPrice },
        label: `Price of ${product.name} here: ${price === null ? "default" : formatMoney(price)}`,
        effects: [{ kind: "update", id: product.id, fields: { branchPrice: price, price: price ?? product.defaultPrice } }],
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    }
  };
  return (
    <Modal title={`Price in ${branchName}`} onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="m-0 text-sm text-muted">Default price {formatMoney(product.defaultPrice)}. Set a different one for this branch only.</p>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <Field label={`Branch price (${currencySign()})`} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} error={text && parsed === null ? "Enter an amount." : undefined} />
        <div className="flex gap-3">
          <Button disabled={!text || parsed === null} onClick={() => save(parsed)}>
            Save
          </Button>
          <Button variant="ghost" onClick={() => save(null)}>
            Use default price
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function ProductsPage() {
  const me = useMe();
  const usable = me.branches.filter((b) => b.withinPlan);
  const [branch, setBranch] = useState(() => currentBranch(me));
  const [products, setProducts] = useState<Product[] | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = usePageSize("products");
  const [allCount, setAllCount] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<null | { kind: "new" } | { kind: "edit" | "stock" | "price" | "batches"; product: Product }>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  useEffect(() => {
    apiGet<Settings>("/settings").then(setSettings, () => {});
  }, []);
  const batches = Boolean(settings?.batchTracking);
  const listWords = taxWordsFor(settings);
  const { groups: taxGroups } = useTaxGroups(listWords.custom);
  const limit = me.plan.current?.limits.maxProducts ?? null;

  // Any filter change starts again from the first page.
  const filters = `${branch?.id}|${q.trim()}|${categoryId}|${stock}|${pageSize}`;
  const lastFilters = useRef(filters);
  useEffect(() => {
    if (lastFilters.current !== filters) {
      lastFilters.current = filters;
      setPage(0);
    }
  }, [filters]);

  const query = useCallback(
    (limit: number, offset: number) => {
      const params = new URLSearchParams({ branchId: branch?.id ?? "", limit: String(limit), offset: String(offset) });
      if (q.trim()) params.set("q", q.trim());
      if (categoryId) params.set("categoryId", categoryId);
      if (stock) params.set("stock", stock);
      return `/products?${params}`;
    },
    [branch, q, categoryId, stock],
  );
  const load = useCallback(() => {
    if (!branch) return;
    Promise.all([apiGet<{ products: Product[]; total: number }>(query(pageSize, page * pageSize)), apiGet<{ categories: Category[] }>("/categories")]).then(
      ([p, c]) => {
        setError(null);
        setProducts(p.products);
        setTotal(p.total);
        setCategories(c.categories);
      },
      (err: unknown) => setError(errorMessage(err)),
    );
  }, [branch, query, page, pageSize]);
  useEffect(() => {
    const t = window.setTimeout(load, 250);
    return () => window.clearTimeout(t);
  }, [load]);
  // How many products the shop has in all (for the plan limit), whatever the filters.
  const loadCount = useCallback(() => {
    if (branch) apiGet<{ total: number }>(`/products?branchId=${branch.id}&limit=1`).then((r) => setAllCount(r.total), () => {});
  }, [branch]);
  useEffect(loadCount, [loadCount]);
  useCacheRefresh(["/products"], () => {
    load();
    loadCount();
  });
  const shown = products ?? [];
  const filtered = Boolean(q.trim() || categoryId || stock);

  /** Every product that matches the filters, not just this page. */
  async function exportCsv() {
    if (!branch) return;
    setExporting(true);
    try {
      const all: Product[] = [];
      for (let offset = 0; ; offset += 2000) {
        const r = await apiGet<{ products: Product[]; total: number }>(query(2000, offset));
        all.push(...r.products);
        if (all.length >= r.total || r.products.length === 0) break;
      }
      downloadCsv(
        `Products_${branch.code}.csv`,
        toCsv(
          ["Name", "SKU", "Barcode", "Category", "HSN", "Selling Price", "Cost Price", "Tax %", "Tax Type", "Stock", "Low Stock Alert", "Unit"],
          all.map((p) => [p.name, p.sku, p.barcode, p.categoryId ? (catName.get(p.categoryId) ?? "") : "", p.hsn, (p.price / 100).toFixed(2), p.costPrice === null || p.costPrice === undefined ? "" : (p.costPrice / 100).toFixed(2), p.gstRateBp / 100, p.taxInclusive ? "inclusive" : "exclusive", p.trackStock ? p.stockMilli / 1000 : "", p.trackStock && p.lowStockMilli !== null ? p.lowStockMilli / 1000 : "", p.unit]),
        ),
      );
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const done = () => {
    setDialog(null);
    load();
  };

  if (!branch) return <Alert tone="warn">No branch is active for you on this plan.</Alert>;

  return (
    <div className="w-full">
      <PageHeader
        title="Products"
        description={`${allCount.toLocaleString("en-IN")}${limit === null ? "" : ` of ${limit.toLocaleString("en-IN")}`} products · prices and stock for ${branch.name} (${branch.code})`}
        actions={
          <div className="flex flex-wrap gap-2">
            {usable.length > 1 ? (
              <select
                aria-label="Branch"
                value={branch.id}
                onChange={(e) => {
                  const b = usable.find((x) => x.id === e.target.value)!;
                  rememberBranch(b.id);
                  setBranch(b);
                }}
                className="h-11 rounded-[10px] border border-line-strong bg-white px-2"
              >
                {usable.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.code})
                  </option>
                ))}
              </select>
            ) : null}
            <Button variant="secondary" disabled={!total} busy={exporting} onClick={() => void exportCsv()}>
              Export CSV
            </Button>
            <Link to="/settings/import" className="flex min-h-11 items-center rounded-[10px] border border-indigo bg-white px-4 text-sm font-semibold text-indigo no-underline">
              Import
            </Link>
            <Button onClick={() => setDialog({ kind: "new" })}>Add product</Button>
          </div>
        }
      />
      {error ? <Alert tone="error">{error}</Alert> : null}
      <label htmlFor="p-search" className="sr-only">
        Search products
      </label>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input id="p-search" type="search" placeholder={`Search name, SKU, barcode${listWords.code ? ` or ${listWords.code}` : ""}`} value={q} onChange={(e) => setQ(e.target.value)} className="h-11 min-w-0 flex-[2_1_260px] rounded-[10px] border border-line-strong bg-white px-3.5 text-sm" />
        <select aria-label="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="h-11 min-w-0 flex-[1_1_160px] rounded-[10px] border border-line-strong bg-white px-2 text-sm">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value="none">No category</option>
        </select>
        <select aria-label="Stock" value={stock} onChange={(e) => setStock(e.target.value)} className="h-11 min-w-0 flex-[1_1_150px] rounded-[10px] border border-line-strong bg-white px-2 text-sm">
          <option value="">All stock</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="ok">In stock</option>
        </select>
        {filtered ? (
          <Button
            variant="ghost"
            onClick={() => {
              setQ("");
              setCategoryId("");
              setStock("");
            }}
          >
            Clear filters
          </Button>
        ) : null}
      </div>
      {products?.length === 0 && filtered ? <Alert tone="info">No products match these filters.</Alert> : null}
      {products?.length === 0 && !filtered ? (
        <Alert tone="info">
          No products yet. Add your first one, or bring them in from a spreadsheet or the free Browser POS in <Link to="/settings/import" className="font-semibold underline">Settings → Import &amp; export</Link>.
        </Alert>
      ) : null}
      <div className="relative overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead>
            <tr className="bg-paper text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-3 py-3 font-medium">{listWords.custom ? "Tax" : `${listWords.code || "Code"} · ${listWords.tax}`}</th>
              <th className="px-3 py-3 font-medium">Price here</th>
              <th className="px-3 py-3 font-medium">Cost</th>
              <th className="px-3 py-3 font-medium">Stock here</th>
              <th className="px-3 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-xs text-muted">{[p.categoryId ? catName.get(p.categoryId) : null, p.sku && `SKU ${p.sku}`, p.barcode && `Barcode ${p.barcode}`].filter(Boolean).join(" · ") || "—"}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-muted">
                  {listWords.custom ? (
                    <>
                      {taxesLabel(productTaxes("CUSTOM", p.taxGroupId, taxGroups) ?? [])} {p.taxInclusive ? "incl." : "+ tax"}
                    </>
                  ) : (
                    <>
                      {p.hsn || "—"} · {bpToPercent(p.gstRateBp)}% {p.taxInclusive ? "incl." : `+ ${listWords.tax}`}
                    </>
                  )}
                </td>
                <td className="px-3 py-3">
                  <button type="button" onClick={() => setDialog({ kind: "price", product: p })} className="flex min-h-9 flex-col items-start text-left">
                    <span className="font-semibold">{formatMoney(p.price)}</span>
                    <span className="text-xs text-indigo underline">{p.branchPrice === null ? "Default · set branch price" : "Branch price · change"}</span>
                  </button>
                </td>
                <td className="px-3 py-3">{p.costPrice === null || p.costPrice === undefined ? "—" : formatMoney(p.costPrice)}</td>
                <td className="px-3 py-3">
                  {p.trackStock ? (
                    <div className="flex flex-col items-start gap-1">
                      <span>
                        {formatQty(p.stockMilli)} {p.unit}
                      </span>
                      {p.stockStatus === "out" ? <Badge tone="error">{p.stockMilli < 0 ? "Below zero" : "Out of stock"}</Badge> : p.stockStatus === "low" ? <Badge tone="warn">Low</Badge> : null}
                      {batches && p.nextExpiry ? <span className="text-xs text-muted">Next expiry {fmtDay(p.nextExpiry)}</span> : null}
                    </div>
                  ) : (
                    <span className="text-muted">Not tracked</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {p.trackStock && batches ? (
                      <Button variant="ghost" onClick={() => setDialog({ kind: "batches", product: p })}>
                        Batches
                      </Button>
                    ) : null}
                    {p.trackStock ? (
                      <Button variant="ghost" onClick={() => setDialog({ kind: "stock", product: p })}>
                        Stock
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setDialog({ kind: "edit", product: p })}>
                      Edit
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPage={setPage} onPageSize={setPageSize} noun="products" />
      {dialog?.kind === "new" || dialog?.kind === "edit" ? (
        <ProductForm product={dialog.kind === "edit" ? dialog.product : null} categories={categories} branchId={branch.id} onDone={done} onClose={() => setDialog(null)} />
      ) : null}
      {dialog?.kind === "batches" ? <BatchesDialog product={dialog.product} branchId={branch.id} onChanged={load} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "stock" ? <StockDialog product={dialog.product} branchId={branch.id} onDone={done} onClose={() => setDialog(null)} /> : null}
      {dialog?.kind === "price" ? <BranchPriceDialog product={dialog.product} branchId={branch.id} branchName={branch.name} onDone={done} onClose={() => setDialog(null)} /> : null}
    </div>
  );
}
