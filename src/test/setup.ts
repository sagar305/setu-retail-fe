import "fake-indexeddb/auto";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { db } from "../offline/db";

afterEach(async () => {
  cleanup();
  window.localStorage.clear();
  await Promise.all(db.tables.map((t) => t.clear()));
});
