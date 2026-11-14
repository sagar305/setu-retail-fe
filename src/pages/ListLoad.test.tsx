import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { makeMe, mockApi, PRODUCTS, session, SETTINGS } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const customer = (id: string, name: string, phone: string) => ({ id, name, phone, email: "", address: "", gstin: null, stateCode: null, notes: "", creditDays: null, createdAt: "2026-11-01T00:00:00.000Z" });
const CUSTOMERS = [customer("77777777-7777-4777-8777-000000000001", "Anil Kumar", "9000000001"), customer("77777777-7777-4777-8777-000000000002", "Meera Shah", "9876543210"), customer("77777777-7777-4777-8777-000000000003", "Ravi", "9123400000")];

describe("lists loaded after sign-in", () => {
  it("loads Products, Customers and Orders in the background, says so, then searches with no API call", async () => {
    const api = mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": [200, SETTINGS],
      "GET /products": [200, { products: PRODUCTS, total: PRODUCTS.length }],
      "GET /categories": [200, { categories: [] }],
      "GET /customers": [200, { customers: CUSTOMERS, total: CUSTOMERS.length }],
      "GET /orders": [200, { orders: [], total: 0 }],
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/customers"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/Everything is loaded: 3 products · 3 customers · 0 bills \(last 3 months\)/)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("progressbar", { name: "Loading your data" })).toBeNull());

    const before = api.calls.filter((c) => c.path === "/customers").length;
    await user.type(screen.getByRole("searchbox", { name: /Search/ }), "meera");
    await waitFor(() => expect(screen.getAllByRole("row")).toHaveLength(2)); // header + Meera
    expect(within(screen.getAllByRole("row")[1]!).getByText("Meera Shah")).toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 300)); // past the old search delay
    expect(api.calls.filter((c) => c.path === "/customers").length).toBe(before);
  });
});
