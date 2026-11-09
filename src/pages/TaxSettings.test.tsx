import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthProvider";
import { setAccessToken } from "../lib/api";
import { makeMe, METHODS, mockApi, session, SETTINGS } from "../test/mockApi";

afterEach(() => {
  vi.restoreAllMocks();
  setAccessToken(null);
});

describe("tax settings", () => {
  it("the owner switches to their own taxes, renames them and adds a tax group", async () => {
    let settings = { ...SETTINGS };
    let groups: unknown[] = [];
    const api = mockApi({
      "POST /auth/refresh": session(makeMe()),
      "GET /settings": () => [200, settings],
      "PATCH /settings": (body) => {
        const b = body as Record<string, unknown>;
        settings = { ...settings, ...b, business: { ...settings.business, ...(b.currency ? { currency: b.currency as string } : {}) } };
        return [200, settings];
      },
      "GET /payment-methods": [200, { methods: METHODS }],
      "GET /tax-groups": () => [200, { groups }],
      "POST /tax-groups": (body) => {
        const b = body as { name: string; taxes: { name: string; rateBp: number }[] };
        groups = [...groups, { id: "66666666-6666-4666-8666-000000000001", ...b, isDefault: groups.length === 0, rateBp: b.taxes.reduce((s, t) => s + t.rateBp, 0), products: 0 }];
        return [201, { group: groups.at(-1) }];
      },
    });
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/settings/pos"]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole("radio", { name: /Your own taxes/ }));
    const sw = screen.getByRole("dialog", { name: "Use your own taxes?" });
    expect(within(sw).getByLabelText("What is your tax called?")).toHaveValue("VAT");
    await user.clear(within(sw).getByLabelText("And your tax number?"));
    await user.type(within(sw).getByLabelText("And your tax number?"), "TRN");
    await user.click(within(sw).getByRole("button", { name: "Use my own taxes" }));
    expect(await screen.findByRole("heading", { name: "Tax groups" })).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === "PATCH")?.body).toEqual({ taxMode: "CUSTOM", taxLabel: "VAT", taxNumberLabel: "TRN", itemCodeLabel: "HS code" });
    expect(screen.getByText("Charge VAT on bills")).toBeInTheDocument();
    expect(screen.getByLabelText("Tax number name")).toHaveValue("TRN");

    await user.clear(screen.getByLabelText("Receipt heading"));
    await user.type(screen.getByLabelText("Receipt heading"), "VAT INVOICE");
    await user.click(screen.getByRole("button", { name: "Save tax words" }));
    expect(await screen.findByText("Saved. Screens and receipts use the new words.")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Currency"), "AED");
    expect(api.calls.filter((c) => c.method === "PATCH").at(-1)?.body).toEqual({ currency: "AED" });

    await user.click(screen.getByRole("button", { name: "Add tax group" }));
    const dlg = screen.getByRole("dialog", { name: "New tax group" });
    await user.type(within(dlg).getByLabelText("Group name"), "Hotel");
    expect(within(dlg).getByLabelText("Tax 1 name")).toHaveValue("VAT");
    await user.type(within(dlg).getByLabelText("Rate %"), "5");
    await user.click(within(dlg).getByRole("button", { name: "+ Add a tax" }));
    await user.type(within(dlg).getByLabelText("Tax 2 name"), "Tourism fee");
    await user.type(within(dlg).getAllByLabelText("Rate %")[1]!, "2");
    await user.click(within(dlg).getByRole("button", { name: "Save group" }));
    expect(api.calls.find((c) => c.method === "POST" && c.path.endsWith("/tax-groups"))?.body).toEqual({
      name: "Hotel",
      taxes: [
        { name: "VAT", rateBp: 500 },
        { name: "Tourism fee", rateBp: 200 },
      ],
    });
    expect(await screen.findByText(/VAT 5% \+ Tourism fee 2% · 0 products/)).toBeInTheDocument();
  });
});
