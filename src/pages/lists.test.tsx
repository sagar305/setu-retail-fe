import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { FullscreenButton } from "../components/FullscreenButton";
import { setAccessToken } from "../lib/api";
import { BRANCH_ID, makeMe, METHODS, mockApi, posRoutes, session } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

const summary = (n: number) => ({
  id: `77777777-7777-4777-8777-${String(n).padStart(12, "0")}`,
  invoiceNumber: `B1-C1-${String(n).padStart(5, "0")}`,
  status: "COMPLETED",
  createdAt: "2026-11-04T10:00:00.000Z",
  branchId: BRANCH_ID,
  customerName: "",
  total: 10000,
  returnedTotal: 0,
  cashierId: "c",
  paymentMethods: ["Cash"],
});

/** The query of the last request to a path. */
const lastQuery = (urls: URL[], path: string) => urls.filter((u) => u.pathname === path).at(-1)?.searchParams;

describe("list pages", () => {
  it("orders: 20 a page by default, next page, payment method and date filters", async () => {
    const urls: URL[] = [];
    mockApi({
      "POST /auth/refresh": session(makeMe({ role: "OWNER" })),
      ...posRoutes(),
      "GET /orders": (_b, url) => {
        urls.push(url);
        const offset = Number(url.searchParams.get("offset"));
        const limit = Number(url.searchParams.get("limit"));
        return [200, { orders: Array.from({ length: Math.min(limit, 45 - offset) }, (_, i) => summary(offset + i + 1)), total: 45 }];
      },
    });
    const user = userEvent.setup();
    renderAt("/orders");
    expect(await screen.findByRole("button", { name: "B1-C1-00001" })).toBeInTheDocument();
    expect(screen.getByText("1–20")).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(lastQuery(urls, "/orders")?.get("limit")).toBe("20");

    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(await screen.findByRole("button", { name: "B1-C1-00021" })).toBeInTheDocument();
    expect(lastQuery(urls, "/orders")?.get("offset")).toBe("20");

    await user.selectOptions(screen.getByLabelText("Rows per page"), "50");
    await waitFor(() => expect(lastQuery(urls, "/orders")?.get("limit")).toBe("50"));
    expect(lastQuery(urls, "/orders")?.get("offset")).toBe("0");

    await user.selectOptions(await screen.findByLabelText("Payment"), "UPI");
    await waitFor(() => expect(lastQuery(urls, "/orders")?.get("methodId")).toBe(METHODS[1]!.id));

    await user.type(screen.getByLabelText("From"), "2026-11-01");
    // The shop's day starts at midnight India time.
    await waitFor(() => expect(lastQuery(urls, "/orders")?.get("from")).toBe("2026-10-31T18:30:00.000Z"));

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    await waitFor(() => expect(lastQuery(urls, "/orders")?.has("methodId")).toBe(false));
  });

  it("products: category and stock filters go to the server", async () => {
    const urls: URL[] = [];
    mockApi({
      "POST /auth/refresh": session(makeMe({ role: "OWNER" })),
      ...posRoutes(),
      "GET /categories": [200, { categories: [{ id: "cat-dairy", name: "Dairy" }] }],
      "GET /products": (_b, url) => {
        urls.push(url);
        return [200, { products: [], total: url.searchParams.get("limit") === "1" ? 120 : 0 }];
      },
    });
    const user = userEvent.setup();
    renderAt("/products");
    expect(await screen.findByText(/120 of/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Stock"), "low");
    await waitFor(() => expect(lastQuery(urls, "/products")?.get("stock")).toBe("low"));
    await user.selectOptions(screen.getByLabelText("Category"), "Dairy");
    await waitFor(() => expect(lastQuery(urls, "/products")?.get("categoryId")).toBe("cat-dairy"));
    expect(lastQuery(urls, "/products")?.get("stock")).toBe("low");
    expect(await screen.findByText("No products match these filters.")).toBeInTheDocument();
  });

  it("full screen: asks the browser, and is hidden where it can't", async () => {
    const { unmount } = render(<FullscreenButton />);
    expect(screen.queryByRole("button", { name: "Full screen" })).not.toBeInTheDocument();
    unmount();

    Object.defineProperty(document, "fullscreenEnabled", { value: true, configurable: true });
    const request = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = request;
    render(<FullscreenButton />);
    await userEvent.click(screen.getByRole("button", { name: "Full screen" }));
    expect(request).toHaveBeenCalled();
    Object.defineProperty(document, "fullscreenEnabled", { value: undefined, configurable: true });
  });
});
