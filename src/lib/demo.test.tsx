import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatCountdown, parseDemoLogin } from "./demo";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("demo mode", () => {
  it("reads the demo login as login|password", () => {
    expect(parseDemoLogin("demo|demo-shop-1234")).toEqual({ login: "demo", password: "demo-shop-1234" });
    expect(parseDemoLogin("demo|pa|ss")).toEqual({ login: "demo", password: "pa|ss" });
    expect(parseDemoLogin("demo")).toBeNull();
    expect(parseDemoLogin(undefined)).toBeNull();
  });

  it("formats the countdown", () => {
    expect(formatCountdown(3849)).toBe("1:04:09");
    expect(formatCountdown(249)).toBe("4:09");
    expect(formatCountdown(-5)).toBe("0:00");
  });

  it("shows the demo login on the sign-in screen and fills it in", async () => {
    vi.stubEnv("VITE_DEMO_MODE", "true");
    vi.stubEnv("VITE_DEMO_LOGIN", "demo|demo-shop-1234");
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
    expect(screen.getByText("This is a demo shop — anyone can sign in")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Use demo login" }));
    expect(screen.getByLabelText("Email or username")).toHaveValue("demo");
    expect(screen.getByLabelText("Password")).toHaveValue("demo-shop-1234");
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
