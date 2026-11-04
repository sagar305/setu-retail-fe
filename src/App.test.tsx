import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { App } from "./App";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("app shell", () => {
  it("starts at sign in", () => {
    renderAt("/");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("hides and shows the sidebar, and remembers the choice", async () => {
    const user = userEvent.setup();
    const { unmount } = renderAt("/dashboard");
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Hide menu" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show menu" })).toHaveAttribute("aria-expanded", "false");

    unmount();
    renderAt("/dashboard");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show menu" }));
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });

  it("marks the current screen in the menu", () => {
    renderAt("/products");
    expect(screen.getByRole("link", { name: "Products" })).toHaveAttribute("aria-current", "page");
  });

  it("sends a cashier away from owner screens to billing", async () => {
    const user = userEvent.setup();
    renderAt("/dashboard");
    await user.selectOptions(screen.getByLabelText("Preview as"), "cashier");
    expect(screen.getByRole("heading", { name: "Billing" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("shows a not-found page inside the shell", () => {
    renderAt("/no-such-page");
    expect(screen.getByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});

describe("sync status", () => {
  it("follows the browser's online and offline events", () => {
    renderAt("/billing");
    expect(screen.getByRole("status")).toHaveTextContent("Online");

    const setOnline = (value: boolean) => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
      act(() => {
        window.dispatchEvent(new Event(value ? "online" : "offline"));
      });
    };

    setOnline(false);
    expect(screen.getByRole("status")).toHaveTextContent("Offline");
    setOnline(true);
    expect(screen.getByRole("status")).toHaveTextContent("Online");
  });
});

describe("on a phone", () => {
  function mockPhone() {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
  }

  it("keeps the menu closed until asked, and closes it after picking a screen", async () => {
    mockPhone();
    const user = userEvent.setup();
    renderAt("/dashboard");
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show menu" }));
    await user.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Show menu" }));
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    // @ts-expect-error restore the jsdom default (no matchMedia = desktop)
    delete window.matchMedia;
  });
});
