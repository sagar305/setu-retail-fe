import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { makeMe, mockApi, session } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const renderHelp = (role: "OWNER" | "CASHIER") => {
  mockApi({ "POST /auth/refresh": session(makeMe({ role })) });
  return render(
    <MemoryRouter initialEntries={["/help"]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
};
const topics = () => screen.getAllByRole("group").map((d) => d.querySelector("summary")?.textContent);

describe("Help", () => {
  it("shows owners the plan, import and setup topics", async () => {
    renderHelp("OWNER");
    expect(await screen.findByRole("heading", { name: "Help" })).toBeInTheDocument();
    expect(topics()).toEqual(["Getting started", "Billing", "When the internet drops", "Staff and what they can do", "Stock, branches and transfers", "Plan, keys and renewals", "Coming from the free Browser POS", "Need help?"]);
  });

  it("shows cashiers only what applies to them", async () => {
    renderHelp("CASHIER");
    expect(await screen.findByRole("heading", { name: "Help" })).toBeInTheDocument();
    expect(topics()).toEqual(["Billing", "When the internet drops", "Need help?"]);
    expect(within(document.getElementById("offline")!).getByRole("link", { name: "Counter PIN" })).toHaveAttribute("href", "/pin");
  });
});
