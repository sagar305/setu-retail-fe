import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiGet } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("apiGet", () => {
  it("returns the JSON body", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 }));
    await expect(apiGet("/health")).resolves.toEqual({ status: "ok" });
  });

  it("turns the API error shape into an ApiError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: { code: "db_unreachable", message: "Database is unreachable." } }), { status: 503 }),
    );
    const err = await apiGet("/health/db").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 503, code: "db_unreachable", message: "Database is unreachable." });
  });

  it("copes with a non-JSON error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("Bad gateway", { status: 502 }));
    await expect(apiGet("/health")).rejects.toMatchObject({ status: 502, code: "http_error" });
  });
});
