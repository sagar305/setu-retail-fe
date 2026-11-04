import { describe, expect, it } from "vitest";
import { homePathFor, navForRole } from "./nav";

const labels = (role: Parameters<typeof navForRole>[0]) => navForRole(role).map((i) => i.label);

describe("navForRole", () => {
  it("gives cashiers only billing, their own sales and customers", () => {
    expect(labels("cashier")).toEqual(["Billing", "My sales", "Customers"]);
  });

  it("keeps plan, branches and settings to the owner", () => {
    expect(labels("owner")).toEqual(expect.arrayContaining(["Branches", "Settings"]));
    expect(labels("manager")).not.toContain("Branches");
    expect(labels("manager")).not.toContain("Settings");
  });

  it("gives managers shop operations", () => {
    expect(labels("manager")).toEqual(
      expect.arrayContaining(["Dashboard", "Products", "Tools", "Stock transfers", "Staff", "Audit log"]),
    );
  });

  it("sends cashiers to billing and others to the dashboard", () => {
    expect(homePathFor("cashier")).toBe("/billing");
    expect(homePathFor("manager")).toBe("/dashboard");
    expect(homePathFor("owner")).toBe("/dashboard");
  });
});
