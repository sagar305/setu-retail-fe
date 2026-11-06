import { describe, expect, it } from "vitest";
import { apiGet, apiPatch, setAccessToken } from "./api";
import { cachePolicy, readCache, recentPaths, setCacheOwner, setInstantCache } from "./cache";
import { seedPaths } from "./prefetch";
import { makeMe, mockApi } from "../test/mockApi";

const NO_NET = () => Promise.reject(new TypeError("Failed to fetch"));

describe("device cache (Phase 9a)", () => {
  it("answers from the device at once and refreshes in the background", async () => {
    await setCacheOwner("u1");
    setInstantCache(true);
    setAccessToken("t");
    let price = 100;
    const api = mockApi({ "GET /products": () => [200, { price }] });
    expect(await apiGet("/products")).toEqual({ price: 100 });
    price = 120;
    // Fresh (<15 s): no request at all.
    expect(await apiGet("/products")).toEqual({ price: 100 });
    expect(api.calls.filter((c) => c.path === "/products")).toHaveLength(1);
  });

  it("uses the device copy when the cloud can't be reached, but not for real errors", async () => {
    await setCacheOwner("u1");
    setAccessToken("t");
    mockApi({ "GET /customers": [200, { customers: ["Meera"] }] });
    await apiGet("/customers");
    mockApi({ "GET /customers": NO_NET as never });
    expect(await apiGet("/customers")).toEqual({ customers: ["Meera"] });
    mockApi({ "GET /customers": [403, { error: { code: "forbidden", message: "No." } }] });
    await expect(apiGet("/customers")).rejects.toThrow("No.");
  });

  it("a saved change makes the next read ask the cloud", async () => {
    await setCacheOwner("u1");
    setInstantCache(true);
    setAccessToken("t");
    let n = 1;
    const api = mockApi({ "GET /settings": () => [200, { n }], "PATCH /settings": [200, {}] });
    await apiGet("/settings");
    n = 2;
    await apiPatch("/settings", { x: 1 });
    expect(await apiGet("/settings")).toEqual({ n: 2 });
    expect(api.calls.filter((c) => c.method === "GET")).toHaveLength(2);
  });

  it("keeps each person's copy apart: another user wipes the old one", async () => {
    await setCacheOwner("u1");
    setAccessToken("t");
    mockApi({ "GET /suppliers": [200, { s: 1 }] });
    await apiGet("/suppliers");
    expect(await readCache("/suppliers")).not.toBeNull();
    await setCacheOwner("u2");
    expect(await readCache("/suppliers")).toBeNull();
    await setCacheOwner("u1");
    expect(await readCache("/suppliers")).toBeNull();
    expect(await recentPaths()).toEqual([]);
  });

  it("never caches sign-in answers", async () => {
    await setCacheOwner("u1");
    setAccessToken("t");
    mockApi({ "GET /me": [200, { me: 1 }] });
    await apiGet("/me");
    expect(await readCache("/me")).toBeNull();
  });

  it("policy: instant under 10 minutes, refresh after 15 seconds", () => {
    setInstantCache(true);
    const now = 1_000_000_000;
    expect(cachePolicy(now - 5_000, now)).toBe("use");
    expect(cachePolicy(now - 60_000, now)).toBe("use-and-refresh");
    expect(cachePolicy(now - 11 * 60_000, now)).toBe("network-first");
    expect(cachePolicy(0, now)).toBe("network-first");
  });

  it("prefetches the main lists a role may see", () => {
    const cashier = seedPaths(makeMe({ role: "CASHIER" }));
    expect(cashier).toContain("/customers?q=&limit=200");
    expect(cashier.some((p) => p.startsWith("/reports") || p.startsWith("/suppliers") || p === "/staff")).toBe(false);
    expect(seedPaths(makeMe({ role: "OWNER" }))).toEqual(expect.arrayContaining(["/reports/dashboard", "/suppliers", "/staff"]));
  });
});
