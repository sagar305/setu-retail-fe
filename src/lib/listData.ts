// Whole lists held in the app, so Products, Customers and Orders search,
// filter and page on this device with no API call. Loaded once in the
// background right after sign-in (a line at the top shows how far it got,
// then a message says everything is loaded), kept up to date with changes
// saved here, and refreshed quietly every few minutes.
//
// Orders: the last ORDER_WINDOW_DAYS days. Older bills are asked of the API.
import type { Effect } from "../offline/db";
import { apiGet, fetchAndCache, isUnreachable, type Customer, type OrderSummary, type Product } from "./api";
import { onCacheUpdate, onLocalEffects } from "./cache";
import { applyEffects } from "./effects";

export type Kind = "products" | "customers" | "orders";
type Rows = { products: Product[]; customers: Customer[]; orders: OrderSummary[] };
export type ListSet<K extends Kind> = { kind: K; key: string; rows: Rows[K]; complete: boolean; at: number };

export const ORDER_WINDOW_DAYS = 90;
const CHUNK: Record<Kind, number> = { products: 2000, customers: 2000, orders: 1000 };
/** The first call is one small page, so the screen and the totals come at once. */
const FIRST = 50;
const REFRESH_MS = 5 * 60_000;

const sets: { [K in Kind]?: ListSet<K> } = {};
type Progress = { running: boolean; loaded: number; total: number };
let progress: Progress = { running: false, loaded: 0, total: 0 };
const listeners = new Set<() => void>();
const doneListeners = new Set<(summary: string) => void>();
let version = 0;
const emit = () => {
  version += 1;
  for (const l of listeners) l();
};

export function subscribeLists(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const listsVersion = () => version;
export const loadProgress = (): Progress => progress;
/** Told once the sign-in load has finished, with what it loaded. */
export function onListsLoaded(fn: (summary: string) => void): () => void {
  doneListeners.add(fn);
  return () => doneListeners.delete(fn);
}

/** The whole list, when it's loaded for this key (branch id for products, window start for orders). */
export function listFor<K extends Kind>(kind: K, key: string): ListSet<K> | null {
  const s = sets[kind] as ListSet<K> | undefined;
  return s && s.complete && s.key === key ? s : null;
}

/** Start of the orders window: midnight, ORDER_WINDOW_DAYS ago (stable for the day, so it works as a key). */
export function ordersFrom(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ORDER_WINDOW_DAYS);
  return d.toISOString();
}

// "all=1" marks this loader's reads (the API ignores it): the background
// refresher skips them (this loader refreshes itself) and screens don't treat
// their cache updates as news.
function pathFor(kind: Kind, key: string, limit: number, offset: number): string {
  if (kind === "products") return `/products?branchId=${key}&limit=${limit}&offset=${offset}&all=1`;
  if (kind === "customers") return `/customers?q=&limit=${limit}&offset=${offset}&all=1`;
  return `/orders?from=${encodeURIComponent(key)}&limit=${limit}&offset=${offset}&all=1`;
}

const ownPaths = new Set<string>();
/** A cache update caused by this loader (screens ignore it, it's not news). */
export const isListLoadPath = (path: string) => ownPaths.has(path) || /[?&]all=1(&|$)/.test(path);

async function get<K extends Kind>(kind: K, path: string): Promise<{ rows: Rows[K]; total: number }> {
  ownPaths.add(path);
  try {
    let r: Record<string, unknown>;
    try {
      r = await fetchAndCache<Record<string, unknown>>(path);
    } catch (err) {
      // No internet: the copy on this device, if there is one.
      if (!isUnreachable(err)) throw err;
      r = await apiGet<Record<string, unknown>>(path);
    }
    const rows = (r[kind] as Rows[K]) ?? ([] as unknown as Rows[K]);
    return { rows, total: typeof r.total === "number" ? r.total : rows.length };
  } finally {
    window.setTimeout(() => ownPaths.delete(path), 0);
  }
}

const running = new Map<Kind, Promise<void>>();
const lastRefresh: Partial<Record<Kind, number>> = {};

/** Load one whole list in chunks; `track` counts it in the top loading line. */
function loadList<K extends Kind>(kind: K, key: string, track: boolean, first?: { rows: Rows[K]; total: number }): Promise<void> {
  const prev = running.get(kind);
  if (prev) return prev;
  const p = (async () => {
    const size = CHUNK[kind];
    const head = first ?? (await get(kind, pathFor(kind, key, size, 0)));
    const seen = new Set<string>();
    const rows: Rows[K][number][] = [];
    const add = (list: Rows[K]) => {
      for (const r of list as { id: string }[]) {
        if (seen.has(r.id)) continue; // a row can shift between chunks while loading
        seen.add(r.id);
        rows.push(r as Rows[K][number]);
      }
    };
    add(head.rows);
    if (track && !first) bump(head.rows.length, head.total);
    for (let offset = head.rows.length; offset < head.total; offset += size) {
      const r = await get(kind, pathFor(kind, key, size, offset));
      add(r.rows);
      if (track) bump(r.rows.length, 0);
      if (!r.rows.length) break;
    }
    sets[kind] = { kind, key, rows: rows as Rows[K], complete: true, at: Date.now() } as never;
    lastRefresh[kind] = Date.now(); // just loaded: other refreshes in the next minute aren't news
    emit();
  })().finally(() => running.delete(kind));
  running.set(kind, p);
  return p;
}

function bump(loaded: number, total: number) {
  progress = { running: true, loaded: progress.loaded + loaded, total: progress.total + total };
  emit();
}

let started = false;
let timer: number | null = null;
let ctx: { productsBranch: string | null; canOrders: boolean } = { productsBranch: null, canOrders: true };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString("en-IN")} ${n === 1 ? one : many}`;

/**
 * Right after sign-in: the first chunk of every list at once (so the totals are
 * known), then the rest, with the top line counting up. Runs once per sign-in.
 */
export async function startListLoad(opts: { productsBranch: string | null; orders: boolean }) {
  if (started) return;
  started = true;
  ctx = { productsBranch: opts.productsBranch, canOrders: opts.orders };
  const kinds: [Kind, string][] = [];
  if (opts.productsBranch) kinds.push(["products", opts.productsBranch]);
  kinds.push(["customers", ""]);
  if (opts.orders) kinds.push(["orders", ordersFrom()]);
  progress = { running: true, loaded: 0, total: 0 };
  emit();
  try {
    const heads = await Promise.all(kinds.map(([kind, key]) => get(kind, pathFor(kind, key, FIRST, 0))));
    heads.forEach((h) => bump(h.rows.length, h.total));
    for (const [i, [kind, key]] of kinds.entries()) await loadList(kind, key, true, heads[i] as never);
    const parts = [
      sets.products ? plural(sets.products.rows.length, "product", "products") : null,
      sets.customers ? plural(sets.customers.rows.length, "customer", "customers") : null,
      sets.orders ? `${plural(sets.orders.rows.length, "bill", "bills")} (last ${Math.round(ORDER_WINDOW_DAYS / 30)} months)` : null,
    ].filter(Boolean);
    for (const l of doneListeners) l(`Everything is loaded: ${parts.join(" · ")}. Search and filters now work instantly.`);
  } catch {
    // Not loaded (no internet, signed out…): screens keep asking the API page by page.
  } finally {
    progress = { running: false, loaded: progress.loaded, total: progress.total };
    emit();
  }
  timer ??= window.setInterval(() => void refreshAll(), REFRESH_MS);
}

/** Products of another branch (the Products screen switched branch): load them too. */
export function ensureProducts(branchId: string) {
  // Before the sign-in load has started, or while it loads this branch: nothing to do.
  if (!started || ctx.productsBranch === branchId || listFor("products", branchId) || running.has("products")) return;
  ctx.productsBranch = branchId;
  progress = { running: true, loaded: 0, total: 0 };
  emit();
  void loadList("products", branchId, true).finally(() => {
    progress = { running: false, loaded: progress.loaded, total: progress.total };
    emit();
  });
}

/** Quietly load a list again (after the API changed it, e.g. a bill synced). */
export function refreshList(kind: Kind) {
  const s = sets[kind];
  if (!s) return;
  const key = kind === "orders" ? ordersFrom() : s.key;
  void loadList(kind, key, false).catch(() => {});
}

async function refreshAll() {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  for (const kind of ["products", "customers", "orders"] as Kind[]) if (sets[kind]) await loadList(kind, kind === "orders" ? ordersFrom() : sets[kind]!.key, false).catch(() => {});
}

// Changes saved on this device show in the lists at once.
onLocalEffects((effects: readonly Effect[]) => {
  let changed = false;
  for (const kind of ["products", "customers", "orders"] as Kind[]) {
    const s = sets[kind];
    if (!s) continue;
    const before = { [kind]: s.rows };
    const after = applyEffects(pathFor(kind, s.key, CHUNK[kind], 0), before, effects) as Record<string, Rows[Kind]>;
    if (after !== before && after[kind] !== s.rows) {
      const rows = kind === "products" ? (after[kind] as Product[]).map(withStockStatus) : after[kind];
      sets[kind] = { ...s, rows } as never;
      changed = true;
    }
  }
  if (changed) emit();
});

// Something else refreshed one of these lists from the API (e.g. a bill made
// at a counter synced): load that list again, quietly and not too often.
onCacheUpdate((path) => {
  if (isListLoadPath(path)) return;
  // Only a list's first page refreshed in the background counts; searches and later pages don't.
  const params = new URLSearchParams(path.split("?")[1] ?? "");
  if ((params.get("q") ?? "") !== "" || Number(params.get("offset") ?? 0) > 0) return;
  const kind = (["products", "customers", "orders"] as Kind[]).find((k) => path.startsWith(`/${k}?`));
  if (!kind || !sets[kind] || running.has(kind)) return;
  if (Date.now() - (lastRefresh[kind] ?? 0) < 60_000) return;
  lastRefresh[kind] = Date.now();
  window.setTimeout(() => refreshList(kind), 2000);
});

/** Signed out: forget everything (the next person may not see the same lists). */
export function resetListData() {
  for (const k of Object.keys(sets) as Kind[]) delete sets[k];
  started = false;
  progress = { running: false, loaded: 0, total: 0 };
  if (timer !== null) window.clearInterval(timer);
  timer = null;
  emit();
}

// ── Filters, the same rules as the API's, so a page looks the same either way ──

export function filterProducts(rows: readonly Product[], f: { q: string; categoryId: string; stock: string }): Product[] {
  const q = f.q.trim();
  const ql = q.toLowerCase();
  return rows.filter(
    (p) =>
      (!f.categoryId || (f.categoryId === "none" ? p.categoryId === null : p.categoryId === f.categoryId)) &&
      (!f.stock || (p.trackStock && p.stockStatus === f.stock)) &&
      (!q || p.name.toLowerCase().includes(ql) || p.sku.toLowerCase() === ql || p.barcode === q || p.hsn.startsWith(q)),
  );
}

export function filterCustomers(rows: readonly Customer[], qRaw: string): Customer[] {
  const q = qRaw.trim();
  if (!q) return [...rows];
  const ql = q.toLowerCase();
  const digits = q.replace(/\D/g, "");
  return rows.filter((c) => c.name.toLowerCase().includes(ql) || (digits.length >= 3 && c.phone.includes(digits)) || c.gstin === q.toUpperCase());
}

export function filterOrders(rows: readonly OrderSummary[], f: { branchId: string; q: string; status: string; methodId: string; from: string | null; to: string | null }): OrderSummary[] {
  const q = f.q.trim();
  const qu = q.toUpperCase();
  const ql = q.toLowerCase();
  const phone = q.replace(/\D/g, "") || q;
  const from = f.from ? Date.parse(f.from) : null;
  const to = f.to ? Date.parse(f.to) : null;
  return rows.filter((o) => {
    const at = Date.parse(o.createdAt);
    return (
      (!f.branchId || o.branchId === f.branchId) &&
      (!f.status || o.status === f.status) &&
      (!f.methodId || o.paymentMethodIds.includes(f.methodId)) &&
      (from === null || at >= from) &&
      (to === null || at < to) &&
      (!q || o.invoiceNumber.includes(qu) || o.customerName.toLowerCase().includes(ql) || o.customerPhone.includes(phone))
    );
  });
}

/** Units at or below which stock counts as low when a product has no alert level (same as the API). */
const DEFAULT_LOW_STOCK_MILLI = 5000;
/** Stock changed here (an edit not yet back from the API): work its status out again. */
export function withStockStatus(p: Product): Product {
  const status = !p.trackStock ? "untracked" : p.stockMilli <= 0 ? "out" : p.stockMilli <= (p.lowStockMilli ?? DEFAULT_LOW_STOCK_MILLI) ? "low" : "ok";
  return status === p.stockStatus ? p : { ...p, stockStatus: status };
}
