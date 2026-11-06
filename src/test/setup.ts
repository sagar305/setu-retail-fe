import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeEach, vi } from "vitest";
import { resetApiState } from "../lib/api";
import { setInstantCache } from "../lib/cache";
import { db } from "../offline/db";
import { setSettings } from "../hooks/useSettings";

// Requests a test didn't mock (including ones still in flight when it ended)
// fail as "no internet" instead of reaching a real server on this machine.
beforeEach(() => {
  resetApiState();
  // Tests re-mock answers between steps: always ask the (mocked) cloud first.
  setInstantCache(false);
  vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new TypeError("Failed to fetch (not mocked in this test)"))));
});
afterAll(() => {
  vi.unstubAllGlobals();
});

afterEach(async () => {
  cleanup();
  setSettings(null);
  window.localStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});
