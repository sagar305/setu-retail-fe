import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { db } from "../offline/db";
import { setSettings } from "../hooks/useSettings";

afterEach(async () => {
  cleanup();
  setSettings(null);
  window.localStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});
