import { describe, expect, it } from "vitest";
import { checkSplit, isUpiMethod, looksLikeUpiId, mergeParts, upiAmountForOrder, upiPaymentLink } from "./payments";
import { pageRule } from "../pos/print";

const M = [{ id: "cash" }, { id: "upi" }, { id: "card" }];

describe("split payments", () => {
  it("is ready only when every part is above zero and they add up to the total exactly", () => {
    expect(checkSplit([{ methodId: "cash", amount: 20000 }, { methodId: "upi", amount: 4300 }], 24300, M)).toMatchObject({ ok: true, remaining: 0 });
    expect(checkSplit([{ methodId: "cash", amount: 20000 }, { methodId: "upi", amount: 4000 }], 24300, M)).toMatchObject({ ok: false, error: "₹3.00 is still due." });
    expect(checkSplit([{ methodId: "cash", amount: 24300 }, { methodId: "upi", amount: 0 }], 24300, M).error).toBe("Every part needs an amount greater than zero.");
    expect(checkSplit([{ methodId: "cash", amount: 25000 }, { methodId: "upi", amount: -700 }], 24300, M).error).toBe("Parts add up to ₹7.00 more than the total.");
    expect(checkSplit([{ methodId: "cash", amount: 24300 }], 24300, M).ok).toBe(false);
    expect(checkSplit([{ methodId: "cash", amount: 100 }, { methodId: "nope", amount: 24200 }], 24300, M).error).toBe("Pick a payment method for every part.");
  });

  it("merges parts paid by the same method", () => {
    expect(mergeParts([{ methodId: "cash", amount: 100 }, { methodId: "upi", amount: 50 }, { methodId: "cash", amount: 25 }])).toEqual([{ methodId: "cash", amount: 125 }, { methodId: "upi", amount: 50 }]);
  });
});

describe("UPI", () => {
  it("knows a UPI method and a UPI ID", () => {
    expect(isUpiMethod({ name: "PhonePe", kind: "UPI" })).toBe(true);
    expect(isUpiMethod({ name: "UPI / GPay", kind: "OTHER" })).toBe(true);
    expect(isUpiMethod({ name: "Cash", kind: "CASH" })).toBe(false);
    expect(looksLikeUpiId("sharma.stores@okaxis")).toBe(true);
    expect(looksLikeUpiId("sharma stores")).toBe(false);
  });

  it("links to the exact amount in rupees, and only with a UPI ID and an amount", () => {
    const link = upiPaymentLink({ upiId: "Shop@OkAxis ", amount: 4350, businessName: "Sharma Stores", note: "Bill B1-C1-00001" });
    expect(link).toBe("upi://pay?pa=shop%40okaxis&pn=Sharma+Stores&am=43.50&cu=INR&tn=Bill+B1-C1-00001");
    expect(upiPaymentLink({ upiId: "", amount: 4350 })).toBe("");
    expect(upiPaymentLink({ upiId: "shop@okaxis", amount: 0 })).toBe("");
    expect(upiPaymentLink({ upiId: "shop@okaxis", amount: 100, currency: "USD" })).toBe("");
  });

  it("puts the UPI share and any udhaar on the receipt's QR, never cash or card", () => {
    const pay = (kind: "CASH" | "UPI" | "CARD" | "CREDIT", amount: number) => ({ methodId: null, methodName: kind, kind, amount });
    expect(upiAmountForOrder({ status: "COMPLETED", payments: [pay("CASH", 20000), pay("UPI", 4300)] })).toBe(4300);
    expect(upiAmountForOrder({ status: "COMPLETED", payments: [pay("CREDIT", 9900)] })).toBe(9900);
    expect(upiAmountForOrder({ status: "COMPLETED", payments: [pay("CASH", 20000), pay("CARD", 100)] })).toBe(0);
    expect(upiAmountForOrder({ status: "CANCELLED", payments: [pay("UPI", 4300)] })).toBe(0);
  });
});

describe("print page size", () => {
  it("prints rolls at their width and the receipt's length, and A4 as A4", () => {
    expect(pageRule("80mm", 378)).toBe("@page { size: 80mm 103mm; margin: 0; }");
    expect(pageRule("58mm", 10)).toBe("@page { size: 58mm 40mm; margin: 0; }");
    expect(pageRule("a4", 2000)).toBe("@page { size: A4; margin: 10mm; }");
  });
});
