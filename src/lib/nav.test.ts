import { describe, expect, it } from "vitest";
import { homePathFor, navForRole } from "./nav";

const labels = (role: Parameters<typeof navForRole>[0]) => navForRole(role).map((i) => i.label);

describe("navForRole", () => {
  it("gives cashiers billing, their own sales, customers and tools (to receive udhaar)", () => {
    expect(labels("CASHIER")).toEqual(["Billing", "My sales", "Customers", "Tools"]);
  });

  it("keeps plan, branches and settings to the owner", () => {
    expect(labels("OWNER")).toEqual(expect.arrayContaining(["Branches", "Settings"]));
    expect(labels("MANAGER")).not.toContain("Branches");
    expect(labels("MANAGER")).not.toContain("Settings");
  });

  it("gives managers shop operations", () => {
    expect(labels("MANAGER")).toEqual(
      expect.arrayContaining(["Dashboard", "Products", "Tools", "Stock transfers", "Staff", "Audit log"]),
    );
  });

  it("sends cashiers to billing and others to the dashboard", () => {
    expect(homePathFor("CASHIER")).toBe("/billing");
    expect(homePathFor("MANAGER")).toBe("/dashboard");
    expect(homePathFor("OWNER")).toBe("/dashboard");
  });
});
