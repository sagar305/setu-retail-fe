import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken, type AuditEntry } from "../lib/api";
import { describeAudit } from "../lib/auditText";
import { makeMe, mockApi, SETTINGS, session } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

const at = (path: string, me = makeMe({ branches: [{}, {}] })) => {
  return { me, render: () => render(<MemoryRouter initialEntries={[path]}><AuthProvider><App /></AuthProvider></MemoryRouter>) };
};

const B1 = "00000000-0000-4000-8000-000000000001";
const B2 = "00000000-0000-4000-8000-000000000002";
const transfer = {
  id: "t1",
  number: "T-00001",
  fromBranchId: B1,
  toBranchId: B2,
  status: "SENT",
  note: "",
  receiveNote: "",
  sentAt: "2026-11-04T09:00:00.000Z",
  sentByName: "Anil",
  receivedAt: null,
  receivedByName: null,
  cancelledAt: null,
  value: 120000,
  shortMilli: 0,
  items: [{ id: "i1", productId: "p1", name: "Tea 250 g", unit: "pcs", qtyMilli: 10000, receivedMilli: null, returnedMilli: 0, writtenOffMilli: 0, unitCost: 12000, batches: [] }],
};

describe("stock transfers", () => {
  it("receives with a short line sent back to the sender", async () => {
    let body: unknown;
    const { me, render: go } = at("/stock-transfers");
    mockApi({
      "POST /auth/refresh": session(me),
      "GET /settings": [200, SETTINGS],
      "GET /transfers": [200, { transfers: [transfer] }],
      "POST /transfers/t1/receive": (b) => {
        body = b;
        return [200, { transfer: { ...transfer, status: "RECEIVED", shortMilli: 2000 } }];
      },
    });
    go();
    expect(await screen.findByText(/on the way to your branch/)).toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "T-00001" }));
    const dlg = screen.getByRole("dialog", { name: "T-00001 · In transit" });
    await user.clear(within(dlg).getByLabelText("Arrived OK"));
    await user.type(within(dlg).getByLabelText("Arrived OK"), "8");
    expect(within(dlg).getByLabelText("2 short / damaged")).toHaveValue("RETURN");
    await user.click(within(dlg).getByRole("button", { name: "Receive · stock in" }));
    expect(body).toMatchObject({ lines: [{ itemId: "i1", receivedMilli: 8000, short: "RETURN" }] });
    expect(await screen.findByText("T-00001 received.")).toBeInTheDocument();
  });

  it("explains transfers when there's only one branch", async () => {
    const { me, render: go } = at("/stock-transfers", makeMe());
    mockApi({ "POST /auth/refresh": session(me), "GET /settings": [200, SETTINGS] });
    go();
    expect(await screen.findByText(/Transfers move stock between your branches/)).toBeInTheDocument();
  });
});

describe("audit log", () => {
  const entry = (action: string, data: unknown, over: Partial<AuditEntry> = {}): AuditEntry => ({ id: action, createdAt: "2026-11-04T09:00:00.000Z", action, entityType: "x", entityId: null, userId: "u", userName: "Anil", role: "OWNER", branchId: B1, branchCode: "B1", ip: "10.0.0.1", data, ...over });

  it("describes entries in plain words", () => {
    expect(describeAudit(entry("product.price_changed", { name: "Tea", from: 14500, to: 15000 }))).toMatchObject({ title: "Price changed", details: ["Tea: ₹145.00 → ₹150.00"] });
    expect(describeAudit(entry("product.updated", { name: "Tea", changes: { gstRateBp: [500, 1200], name: ["Tea", "Tea 250g"] } })).details).toEqual(["Tea: GST rate: 500 → 1200", "name: Tea → Tea 250g"]);
    expect(describeAudit(entry("auth.sign_in_failed", { attempt: 5, locked: true }))).toMatchObject({ title: "Wrong password", tone: "warn", details: ["Too many tries: locked for 15 minutes"] });
    expect(describeAudit(entry("transfer.received", { number: "T-00001", short: [{ name: "Tea", returnedMilli: 2000, writtenOffMilli: 0 }] })).details).toEqual(["T-00001", "Tea: 2 back to sender"]);
  });

  it("filters by what happened", async () => {
    const paths: string[] = [];
    const { me, render: go } = at("/audit-log");
    mockApi({
      "POST /auth/refresh": session(me),
      "GET /settings": [200, SETTINGS],
      "GET /audit-log/filters": [200, { actions: [], users: [{ id: "u", name: "Anil", role: "OWNER" }] }],
      "GET /audit-log": (_b, url) => {
        paths.push(url.search);
        return [200, { entries: [entry("order.cancelled", { invoiceNumber: "B1-C1-00007", total: 29000, reason: "Wrong item" })], next: null }];
      },
    });
    go();
    expect(await screen.findByText("Bill cancelled")).toBeInTheDocument();
    expect(screen.getByText(/B1-C1-00007 · ₹290.00 · “Wrong item”/)).toBeInTheDocument();
    await userEvent.setup().selectOptions(screen.getByLabelText("What"), "order.");
    await screen.findByText("Bill cancelled");
    expect(paths.at(-1)).toContain("action=order.");
  });
});
