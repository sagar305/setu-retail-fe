import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Root } from "../Root";
import { mockApi, NOT_SIGNED_IN } from "../test/mockApi";
import { resetAdminApi, type AccountDetail, type Admin } from "./api";

afterEach(() => {
  vi.restoreAllMocks();
  resetAdminApi();
});

const ADMIN: Admin = { id: "a1", email: "ops@setutechnology.com", name: "Ops", status: "ACTIVE", twoFactor: true, lastLoginAt: null, createdAt: "2026-11-01T00:00:00.000Z" };
const session = (admin = ADMIN) => [200, { accessToken: "admin-token", expiresIn: 600, admin }] as [number, unknown];
const DASH = { accounts: 12, trial: 7, paidByPlan: [{ code: "gold", name: "Gold", accounts: 3 }], granted: 1, expired: 1, unverified: 0, locked: 0, expiringIn14Days: 2, signupsThisMonth: 4, remindersLast7Days: 5 };

const ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
function detail(over: Partial<AccountDetail["account"]> = {}): AccountDetail {
  return {
    account: { id: ACCOUNT_ID, name: "Chain Mart", phone: "9876500001", ownerName: "Meera", ownerEmail: "meera@example.com", status: "paid", planCode: "gold", planName: "Gold", endsAt: "2027-11-05T00:00:00.000Z", daysLeft: 365, branches: 4, lastActiveAt: null, createdAt: "2026-11-01T00:00:00.000Z", taxNumber: null, timezone: "Asia/Kolkata", lockedAt: null, lockReason: null, ownerVerified: true, ownerId: "o1", ...over },
    plan: { expired: false, daysLeft: 365, code: "gold", name: "Gold", source: "KEY", limits: { maxBranches: 10, maxStaff: 30, maxProducts: 10000, maxCustomers: 20000, maxOrdersPerMonth: 30000 } },
    usage: { branches: 4, staff: 6, products: 120, customers: 40, ordersThisMonth: 300 },
    timeline: [],
    redemptions: [],
    issuedKeys: [],
    reminders: [],
    activity: [],
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Root />
    </MemoryRouter>,
  );
}

describe("super-admin", () => {
  it("first sign-in links an authenticator app, then shows the dashboard", async () => {
    const api = mockApi({
      "POST /admin/auth/refresh": NOT_SIGNED_IN,
      "POST /admin/auth/login": [200, { step: "setup", token: "setup-token", secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP", otpauthUrl: "otpauth://totp/Setu%20Retail%20Admin%3Aops?secret=JBSWY3DPEHPK3PXP&issuer=Setu%20Retail%20Admin" }],
      "POST /admin/auth/setup-2fa": session(),
      "GET /admin/dashboard": [200, DASH],
    });
    const user = userEvent.setup();
    renderAt("/super-admin");
    expect(await screen.findByRole("heading", { name: "Setu team sign-in" })).toBeInTheDocument();
    // The shop app's session check never runs here.
    expect(api.calls.some((c) => c.path === "/auth/refresh")).toBe(false);

    await user.type(screen.getByLabelText("Email"), "ops@setutechnology.com");
    await user.type(screen.getByLabelText("Password"), "admin-pass-123");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("heading", { name: "Set up two-step sign-in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Setup key")).toHaveTextContent("JBSW Y3DP EHPK 3PXP");
    expect(await screen.findByAltText(/QR code/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Code from the app"), "123 456");
    await user.click(screen.getByRole("button", { name: "Turn on and sign in" }));
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/admin/auth/setup-2fa")?.body).toEqual({ token: "setup-token", code: "123456" });
    expect(screen.getByRole("link", { name: /On free trial\s*7/ })).toHaveAttribute("href", "/super-admin/accounts?status=trial");
    expect(screen.getByRole("link", { name: /Paying\s*3/ })).toBeInTheDocument();
  });

  it("asks for the code on later sign-ins and shows a wrong code", async () => {
    mockApi({
      "POST /admin/auth/refresh": NOT_SIGNED_IN,
      "POST /admin/auth/login": [200, { step: "code", token: "mfa-token" }],
      "POST /admin/auth/verify": [401, { error: { code: "invalid_code", message: "That code didn't match. Try the newest code in your authenticator app." } }],
    });
    const user = userEvent.setup();
    renderAt("/super-admin/accounts");
    await user.type(await screen.findByLabelText("Email"), "ops@setutechnology.com");
    await user.type(screen.getByLabelText("Password"), "admin-pass-123");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.type(await screen.findByLabelText("Authenticator code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("didn't match");
  });

  it("locks an account with a reason, and issues a Contact-sales key shown once", async () => {
    let locked = false;
    const api = mockApi({
      "POST /admin/auth/refresh": session(),
      [`GET /admin/accounts/${ACCOUNT_ID}`]: () => [200, detail(locked ? { status: "locked", lockedAt: "2026-11-05T05:00:00.000Z", lockReason: "Chargeback" } : {})],
      [`POST /admin/accounts/${ACCOUNT_ID}/lock`]: () => {
        locked = true;
        return [200, { locked: true }];
      },
      "POST /admin/keys": [201, { id: "k1", key: "SETU-R-AAAAAA-BBBBBB", emailedTo: "meera@example.com", redeemUrl: "x" }],
    });
    const user = userEvent.setup();
    renderAt(`/super-admin/accounts/${ACCOUNT_ID}`);
    expect(await screen.findByRole("heading", { name: "Chain Mart" })).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Branches" })).toHaveAttribute("aria-valuemax", "10");

    await user.click(screen.getByRole("button", { name: "Lock account" }));
    const dialog = screen.getByRole("dialog", { name: "Lock account" });
    await user.type(within(dialog).getByLabelText("Reason"), "Chargeback");
    await user.click(within(dialog).getByRole("button", { name: "Lock account" }));
    expect(await screen.findByText(/Locked on .*: Chargeback/)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path.endsWith("/lock"))?.body).toEqual({ reason: "Chargeback" });

    await user.click(screen.getByRole("button", { name: "Issue Contact-sales key" }));
    const keyDialog = screen.getByRole("dialog", { name: "Issue Contact-sales key" });
    await user.clear(within(keyDialog).getByLabelText("Branches"));
    await user.type(within(keyDialog).getByLabelText("Branches"), "250");
    await user.type(within(keyDialog).getByLabelText("Products"), "50000");
    await user.type(within(keyDialog).getByLabelText(/Note/), "PO 4471");
    await user.click(within(keyDialog).getByRole("button", { name: "Issue key" }));
    expect(await within(keyDialog).findByText("SETU-R-AAAAAA-BBBBBB")).toBeInTheDocument();
    expect(within(keyDialog).getByText(/emailed to meera@example.com/)).toBeInTheDocument();
    expect(api.calls.find((c) => c.path === "/admin/keys")?.body).toEqual({ accountId: ACCOUNT_ID, days: 365, maxBranches: 250, maxStaff: 1000, maxProducts: 50000, maxCustomers: null, maxOrdersPerMonth: null, note: "PO 4471" });
  });

  it("a shop session doesn't open the admin, and the shop app never links to it", async () => {
    const api = mockApi({ "POST /admin/auth/refresh": NOT_SIGNED_IN });
    renderAt("/super-admin/team");
    expect(await screen.findByRole("heading", { name: "Setu team sign-in" })).toBeInTheDocument();
    expect(api.calls.map((c) => c.path)).toEqual(["/admin/auth/refresh"]);
    const { NAV_ITEMS } = await import("../lib/nav");
    expect(NAV_ITEMS.some((i) => i.path.startsWith("/super-admin"))).toBe(false);
  });
});
