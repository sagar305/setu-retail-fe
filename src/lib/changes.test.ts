import { describe, expect, it } from "vitest";
import { db } from "../offline/db";
import { mockApi } from "../test/mockApi";
import { apiGet, setAccessToken } from "./api";
import { readCache, setCacheOwner } from "./cache";
import { flushChanges, saveChange } from "./changes";
import { applyEffects } from "./effects";

const PRODUCTS = { products: [{ id: "p1", name: "Tea", price: 10000, stockMilli: 5000 }, { id: "p2", name: "Atta", price: 5000, stockMilli: 0 }], total: 2 };

describe("effects", () => {
  it("update, remove and insert on any cached answer", () => {
    const upd = applyEffects("/products?branchId=b", PRODUCTS, [{ kind: "update", id: "p1", fields: { price: 12000, notAField: 1 } }]) as typeof PRODUCTS;
    expect(upd.products[0]).toEqual({ id: "p1", name: "Tea", price: 12000, stockMilli: 5000 });
    const rem = applyEffects("/products?branchId=b", PRODUCTS, [{ kind: "remove", id: "p2" }]) as typeof PRODUCTS;
    expect(rem.products.map((p) => p.id)).toEqual(["p1"]);
    const ins = applyEffects("/products?branchId=b", PRODUCTS, [{ kind: "insert", into: "/products?", key: "products", item: { id: "p3", name: "Soap" } }]) as typeof PRODUCTS;
    expect(ins.products.map((p) => p.id)).toEqual(["p3", "p1", "p2"]);
    expect(ins.total).toBe(3);
    // Inserted only into the matching lists, and only once.
    expect(applyEffects("/customers?q=", { customers: [] }, [{ kind: "insert", into: "/products?", key: "products", item: { id: "p3" } }])).toEqual({ customers: [] });
    expect((applyEffects("/products?x", ins, [{ kind: "insert", into: "/products?", key: "products", item: { id: "p3" } }]) as typeof PRODUCTS).products).toHaveLength(3);
  });
});

describe("changes saved on this device (Phase 9b)", () => {
  it("shows at once, survives a fresh cloud copy until sent, then is sent once with its id and base", async () => {
    await setCacheOwner("u1");
    setAccessToken("t");
    const routes = {
      "GET /products": () => [200, PRODUCTS] as [number, unknown],
    };
    const api = mockApi(routes);
    await apiGet("/products?branchId=b");
    await saveChange({ method: "PATCH", path: "/products/p1", body: { price: 12000 }, base: { price: 10000 }, label: "Price of Tea", effects: [{ kind: "update", id: "p1", fields: { price: 12000 } }] });
    expect(((await readCache<typeof PRODUCTS>("/products?branchId=b"))!.data.products[0]!.price)).toBe(12000);

    // A fresh copy from the cloud (which doesn't have it yet) still shows it.
    const { fetchAndCache } = await import("./api");
    await fetchAndCache("/products?branchId=b");
    expect(((await readCache<typeof PRODUCTS>("/products?branchId=b"))!.data.products[0]!.price)).toBe(12000);

    // Offline: it waits.
    api.spy.mockRestore();
    mockApi({ "PATCH /products/p1": () => Promise.reject(new TypeError("offline")) as never });
    expect(await flushChanges()).toMatchObject({ sent: 0, state: "offline" });
    expect(await db.changes.count()).toBe(1);

    // Online: sent with the Idempotency-Key and what the device saw.
    const spy = mockApi({ "PATCH /products/p1": () => [200, { product: {}, conflicts: 1 }] as [number, unknown] }).spy;
    let reviewEvents = 0;
    window.addEventListener("setu:review", () => (reviewEvents += 1));
    expect(await flushChanges()).toMatchObject({ sent: 1, conflicts: 1, state: "done" });
    const init = spy.mock.calls[0]![1] as RequestInit;
    const sent = [{ body: JSON.parse(String(init.body)), key: (init.headers as Record<string, string>)["Idempotency-Key"] ?? null }];
    expect(sent[0]!.body).toMatchObject({ price: 12000, _base: { price: 10000 } });
    expect(sent[0]!.key).toMatch(/^[0-9a-f]{32}$/);
    expect(reviewEvents).toBe(1);
    expect(await db.changes.count()).toBe(0);
  });

  it("a change the cloud refuses is kept with the reason and stops showing", async () => {
    await setCacheOwner("u1");
    setAccessToken("t");
    mockApi({ "GET /customers": [200, { customers: [], total: 0 }] });
    await apiGet("/customers?q=");
    await saveChange({ method: "POST", path: "/customers", body: { id: "c1", name: "Meera" }, label: "New customer Meera", effects: [{ kind: "insert", into: "/customers?", key: "customers", item: { id: "c1", name: "Meera" } }] });
    expect((await readCache<{ customers: unknown[] }>("/customers?q="))!.data.customers).toHaveLength(1);
    mockApi({ "POST /customers": [403, { error: { code: "plan_limit", message: "Your plan allows 2,000 customers." } }], "GET /customers": [200, { customers: [], total: 0 }] });
    expect(await flushChanges()).toMatchObject({ rejected: 1 });
    expect((await db.changes.toArray())[0]).toMatchObject({ status: "rejected", message: "Your plan allows 2,000 customers." });
    // The next cloud copy no longer shows it.
    const { fetchAndCache } = await import("./api");
    await fetchAndCache("/customers?q=");
    expect((await readCache<{ customers: unknown[] }>("/customers?q="))!.data.customers).toHaveLength(0);
  });

  it("only the person who made a change sends it", async () => {
    await setCacheOwner("u1");
    await saveChange({ method: "POST", path: "/expenses", body: { id: "e1" }, label: "Expense" });
    await setCacheOwner("u2");
    setAccessToken("t");
    const api = mockApi({});
    expect(await flushChanges()).toMatchObject({ sent: 0 });
    expect(api.calls).toHaveLength(0);
    expect(await db.changes.count()).toBe(1);
  });
});
