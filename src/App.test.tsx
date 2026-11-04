import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthProvider";
import { setAccessToken } from "./lib/api";
import { makeMe, mockApi, NOT_SIGNED_IN, posRoutes, session } from "./test/mockApi";

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

describe("signing in", () => {
  it("sends a signed-out visitor to sign in, then to where they were going", async () => {
    const me = makeMe();
    const api = mockApi({ "POST /auth/refresh": NOT_SIGNED_IN, "POST /auth/login": session(me) });
    const user = userEvent.setup();
    renderAt("/staff");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

    await user.type(screen.getByLabelText("Email or username"), "anil");
    await user.type(screen.getByLabelText("Password"), "s3cret-pass");
    mockApi({ "POST /auth/refresh": NOT_SIGNED_IN, "POST /auth/login": session(me), "GET /staff": [200, { staff: [] }] });
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("heading", { name: "Staff" })).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === "/auth/refresh")).toBe(true);
  });

  it("explains an unverified email and offers to resend", async () => {
    const api = mockApi({
      "POST /auth/refresh": NOT_SIGNED_IN,
      "POST /auth/login": [403, { error: { code: "email_not_verified", message: "Verify your email first." } }],
      "POST /auth/resend-verification": [202, { status: "sent_if_account_exists" }],
    });
    const user = userEvent.setup();
    renderAt("/sign-in");
    await user.type(await screen.findByLabelText("Email or username"), "a@x.com");
    await user.type(screen.getByLabelText("Password"), "whatever-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await user.click(await screen.findByRole("button", { name: "Send the link again" }));
    expect(await screen.findByText(/sent the link again/)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/auth/resend-verification")?.body).toEqual({ email: "a@x.com" });
  });

  it("restores the session on load and lands a cashier on billing", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), ...posRoutes() });
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Billing" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "My sales" })).toBeInTheDocument();
  });

  it("keeps cashiers off owner screens", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ role: "CASHIER" })), ...posRoutes() });
    renderAt("/settings/plan");
    expect(await screen.findByRole("heading", { name: "Billing" })).toBeInTheDocument();
  });

  it("signs out", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), "POST /auth/logout": [204] });
    const user = userEvent.setup();
    renderAt("/dashboard");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("retries a request once after refreshing an expired access token", async () => {
    let staffCalls = 0;
    let refreshes = 0;
    mockApi({
      "POST /auth/refresh": () => {
        refreshes += 1;
        return session(makeMe());
      },
      "GET /staff": () => {
        staffCalls += 1;
        return staffCalls === 1 ? [401, { error: { code: "not_signed_in", message: "x" } }] : [200, { staff: [] }];
      },
    });
    renderAt("/staff");
    expect(await screen.findByText(/staff logins on your plan/)).toBeInTheDocument();
    await waitFor(() => expect(staffCalls).toBe(2));
    expect(refreshes).toBe(2);
  });
});

describe("sign up", () => {
  it("creates the account and asks to check email", async () => {
    const api = mockApi({ "POST /auth/refresh": NOT_SIGNED_IN, "POST /auth/signup": [201, { status: "verification_sent", email: "a@x.com" }] });
    const user = userEvent.setup();
    renderAt("/sign-up");
    await user.type(await screen.findByLabelText("Business name"), "Sharma Stores");
    await user.type(screen.getByLabelText("Your name"), "Anil");
    await user.type(screen.getByLabelText("Email"), "a@x.com");
    await user.type(screen.getByLabelText("Username"), "anil");
    await user.type(screen.getByLabelText("Password"), "s3cret-pass");
    await user.type(screen.getByLabelText("Mobile number"), "9876543210");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/auth/signup")?.body).toMatchObject({ businessName: "Sharma Stores", phone: "9876543210" });
  });

  it("shows a used phone number next to the field", async () => {
    mockApi({
      "POST /auth/refresh": NOT_SIGNED_IN,
      "POST /auth/signup": [409, { error: { code: "phone_used", message: "This phone number is already used by another shop's account." } }],
    });
    const user = userEvent.setup();
    renderAt("/sign-up");
    for (const [label, value] of [["Business name", "S"], ["Your name", "A"], ["Email", "a@x.com"], ["Username", "anil"], ["Password", "s3cret-pass"], ["Mobile number", "9876543210"]] as const) {
      await user.type(await screen.findByLabelText(label), value);
    }
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/already used by another shop/)).toBeInTheDocument();
    expect(screen.getByLabelText("Mobile number")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("plan", () => {
  it("an owner whose plan ended only sees the plan screen", async () => {
    mockApi({
      "POST /auth/refresh": session(makeMe({ expired: true })),
      "GET /account/plan": [200, { plan: makeMe({ expired: true }).plan, usage: {}, keepActiveReviewPending: false }],
    });
    renderAt("/dashboard");
    expect(await screen.findByRole("heading", { name: "Plan & license key" })).toBeInTheDocument();
    expect(screen.getAllByText(/Your plan has ended/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Staff" })).not.toBeInTheDocument();
  });

  it("checks a key, asks now-or-later for a different plan, and redeems", async () => {
    const me = makeMe();
    const api = mockApi({
      "POST /auth/refresh": session(me),
      "GET /me": [200, me],
      "GET /account/plan": [200, { plan: me.plan, usage: { branches: 1, staff: 0, products: 0, customers: 0, ordersThisMonth: 0 }, keepActiveReviewPending: false }],
      "POST /account/license/check": [
        200,
        {
          plan: { code: "gold", name: "Gold" },
          days: 365,
          needsChoice: true,
          options: [
            { choice: "now", convertedDays: 0, startsAt: "2026-11-04T10:00:00.000Z", endsAt: "2027-11-04T10:00:00.000Z" },
            { choice: "later", convertedDays: 0, startsAt: "2027-02-04T10:00:00.000Z", endsAt: "2028-02-04T10:00:00.000Z" },
          ],
        },
      ],
      "POST /account/license/redeem": [200, { plan: me.plan, keepActiveReviewPending: false }],
    });
    const user = userEvent.setup();
    renderAt("/settings/plan");
    expect(await screen.findByText(/1 of 1/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/License key/), "SETU-R-TESTKEY-ABCDEF");
    await user.click(screen.getByRole("button", { name: "Check key" }));
    expect(await screen.findByText(/Valid key: Gold · 365 days/)).toBeInTheDocument();
    expect(screen.getByText(/Your free trial ends now/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Start after my current plan/ }));
    await user.click(screen.getByRole("button", { name: "Redeem key" }));
    expect(await screen.findByText("Gold key redeemed.")).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/account/license/redeem")?.body).toEqual({ key: "SETU-R-TESTKEY-ABCDEF", choice: "later" });
  });

  it("after a downgrade the owner picks what stays active, oldest pre-selected", async () => {
    const me = makeMe({ review: true });
    const branches = [
      { ...me.branches[0]!, withinPlan: true },
      { ...me.branches[0]!, id: "00000000-0000-4000-8000-000000000002", code: "B2", name: "Indiranagar", withinPlan: false, createdAt: "2026-05-01T00:00:00.000Z" },
    ];
    const api = mockApi({
      "POST /auth/refresh": session(me),
      "GET /me": [200, { ...me, account: { ...me.account, keepActiveReviewPending: false } }],
      "GET /account/keep-active": [200, { limits: { maxBranches: 1, maxStaff: 3 }, branches, staff: [] }],
      "POST /account/keep-active": [200, { saved: true }],
    });
    const user = userEvent.setup();
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Choose what stays active" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Main branch/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Indiranagar/ }));
    await user.click(screen.getByRole("button", { name: "Auto-select oldest" }));
    expect(screen.getByRole("radio", { name: /Main branch/ })).toBeChecked();
    await user.click(screen.getByRole("radio", { name: /Indiranagar/ }));
    await user.click(screen.getByRole("button", { name: "Confirm and continue" }));
    await waitFor(() => expect(api.calls.find((c) => c.method === "POST" && c.path === "/account/keep-active")?.body).toEqual({ branchIds: [branches[1]!.id], staffIds: [] }));
  });

  it("warns when the trial is about to end", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe({ trialDaysLeft: 5 })) });
    renderAt("/dashboard");
    expect(await screen.findByText(/free trial ends on/)).toBeInTheDocument();
  });
});

describe("app shell", () => {
  it("hides and shows the sidebar, and remembers the choice", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()) });
    const user = userEvent.setup();
    const { unmount } = renderAt("/dashboard");
    expect(await screen.findByRole("navigation", { name: "Main" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hide menu" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    unmount();
    renderAt("/dashboard");
    expect(await screen.findByRole("button", { name: "Show menu" })).toHaveAttribute("aria-expanded", "false");
  });

  it("follows the browser's online and offline events", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()), "GET /branches": [200, { branches: [] }] });
    renderAt("/branches");
    const chip = await screen.findByText("Online");
    const setOnline = (value: boolean) => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => value });
      act(() => {
        window.dispatchEvent(new Event(value ? "online" : "offline"));
      });
    };
    setOnline(false);
    expect(chip.closest("[role=status]")).toHaveTextContent("Offline");
    setOnline(true);
    expect(chip.closest("[role=status]")).toHaveTextContent("Online");
  });

  it("on a phone the menu is a drawer that closes after picking a screen", async () => {
    window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {} })) as unknown as typeof window.matchMedia;
    mockApi({ "POST /auth/refresh": session(makeMe()) });
    const user = userEvent.setup();
    renderAt("/dashboard");
    await user.click(await screen.findByRole("button", { name: "Show menu" }));
    await user.click(screen.getByRole("link", { name: "Products" }));
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Products" })).toBeInTheDocument();
    // @ts-expect-error restore the jsdom default (no matchMedia = desktop)
    delete window.matchMedia;
  });

  it("shows a not-found page inside the shell", async () => {
    mockApi({ "POST /auth/refresh": session(makeMe()) });
    renderAt("/no-such-page");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });

  it("explains when the API can't be reached", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    renderAt("/dashboard");
    expect(await screen.findByText(/Can't reach Setu Retail/)).toBeInTheDocument();
  });
});
