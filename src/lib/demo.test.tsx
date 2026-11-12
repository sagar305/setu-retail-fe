import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCountdown, isOn, parseDemoLogins } from "./demo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("demo mode", () => {
  it("reads the demo login as login|password", () => {
    expect(parseDemoLogins("Owner=owner|pw-1;Manager=manager|pw=2;Cashier=cashier|p|w")).toEqual([
      { label: "Owner", login: "owner", password: "pw-1" },
      { label: "Manager", login: "manager", password: "pw=2" },
      { label: "Cashier", login: "cashier", password: "p|w" },
    ]);
    expect(parseDemoLogins("demo|demo-shop-1234")).toEqual([{ label: "Demo", login: "demo", password: "demo-shop-1234" }]);
    expect(parseDemoLogins("demo")).toEqual([]);
    expect(parseDemoLogins(undefined)).toEqual([]);
  });

  it("accepts the switch however it was typed into the dashboard", () => {
    for (const v of ["true", "True", " TRUE ", '"true"', "'true'", "1", "yes", "on"]) expect(isOn(v)).toBe(true);
    for (const v of [undefined, "", "false", "0", "no", "truee"]) expect(isOn(v)).toBe(false);
    expect(parseDemoLogins('"Owner=owner|pw"')).toEqual([{ label: "Owner", login: "owner", password: "pw" }]);
  });

  it("formats the countdown", () => {
    expect(formatCountdown(3849)).toBe("1:04:09");
    expect(formatCountdown(249)).toBe("4:09");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("signs in as a role with one tap on the demo sign-in screen", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.stubEnv("VITE_DEMO_LOGIN", "Owner=owner|demo-shop-1234;Manager=manager|demo-shop-1234;Cashier=cashier|demo-shop-1234");
    const { SignIn } = await import("../pages/auth/SignIn");
    const { AuthProvider } = await import("../auth/AuthProvider");
    const { makeMe, mockApi, NOT_SIGNED_IN, session } = await import("../test/mockApi");
    const { calls } = mockApi({ "POST /auth/refresh": NOT_SIGNED_IN, "POST /auth/login": session(makeMe({ role: "CASHIER" })) });
    render(
      <MemoryRouter>
        <AuthProvider>
          <SignIn />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText("This is a demo shop — try it as any role")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("Manager")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Sign in as Cashier" }));
    await waitFor(() => expect(calls.find((c) => c.path === "/auth/login")?.body).toEqual({ login: "cashier", password: "demo-shop-1234" }));
    expect(screen.getByRole("link", { name: /Create account/ })).toHaveAttribute("href", "https://app.retail-pos.setutechnology.com/sign-up");
  });

  it("shows nothing of the demo in the real app", async () => {
    const { SignIn } = await import("../pages/auth/SignIn");
    const { AuthProvider } = await import("../auth/AuthProvider");
    const { mockApi, NOT_SIGNED_IN } = await import("../test/mockApi");
    mockApi({ "POST /auth/refresh": NOT_SIGNED_IN });
    render(
      <MemoryRouter>
        <AuthProvider>
          <SignIn />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.queryByText("This is a demo shop — anyone can sign in")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Create account/ })).toHaveAttribute("href", "/sign-up");
  });

  it("counts down to the next reset in the demo", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    const { DemoBanner } = await import("../components/DemoBanner");
    const { mockApi } = await import("../test/mockApi");
    mockApi({ "GET /demo/reset": [200, { enabled: true, intervalHours: 2, nextResetAt: "2026-11-07T06:00:00.000Z", secondsUntilReset: 3849, resetting: false }] });
    render(<DemoBanner />);
    expect(await screen.findByRole("status", { name: "Demo: sample data is restored in 1:04:09" })).toBeInTheDocument();
  });
});
