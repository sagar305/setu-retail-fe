import { describe, expect, it } from "vitest";
import { amountInWords, formatMoney, formatQty, parseMoney, parseQty } from "./money";

describe("money", () => {
  it("formats rupees Indian-style", () => {
    expect(formatMoney(12345678)).toBe("₹1,23,456.78");
    expect(formatMoney(69500)).toBe("₹695.00");
  });
  it("parses typed amounts", () => {
    expect(parseMoney("285")).toBe(28500);
    expect(parseMoney("1,234.5")).toBe(123450);
    expect(parseMoney("₹ 0.05")).toBe(5);
    expect(parseMoney("12.345")).toBeNull();
    expect(parseMoney("abc")).toBeNull();
  });
  it("quantities in thousandths", () => {
    expect(parseQty("1.25")).toBe(1250);
    expect(parseQty("2")).toBe(2000);
    expect(parseQty("1.2345")).toBeNull();
    expect(formatQty(1500)).toBe("1.5");
  });
  it("amount in words, lakh/crore", () => {
    expect(amountInWords(69500)).toBe("Rupees Six Hundred Ninety-Five Only");
    expect(amountInWords(12345678950)).toBe("Rupees Twelve Crore Thirty-Four Lakh Fifty-Six Thousand Seven Hundred Eighty-Nine and Fifty Paise Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });
});

describe("money in the shop's currency", () => {
  it("formats and words amounts in other currencies; INR keeps Indian numbering", async () => {
    const { amountInWords, formatMoney, setMoneyCurrency, parseMoney } = await import("./money");
    expect(amountInWords(123_456_750, "AED")).toBe("One Million Two Hundred Thirty-Four Thousand Five Hundred Sixty-Seven United Arab Emirates Dirhams and 50/100 Only");
    expect(amountInWords(10_000, "USD")).toBe("One Hundred US Dollars Only");
    expect(amountInWords(1_00_00_000_00, "INR")).toBe("Rupees One Crore Only");
    setMoneyCurrency("AED");
    try {
      expect(formatMoney(12_345)).toMatch(/AED\s?123\.45/);
      expect(parseMoney("AED 12.50")).toBe(1250);
      expect(parseMoney("$9")).toBe(900);
    } finally {
      setMoneyCurrency("INR");
    }
    expect(formatMoney(12_345)).toBe("₹123.45");
  });
});
