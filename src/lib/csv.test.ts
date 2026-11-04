import { describe, expect, it } from "vitest";
import { csvRecords, parseCsv, toCsv } from "./csv";
import { presetDays, toRange } from "./ranges";

describe("csv", () => {
  it("round-trips quotes, commas and newlines", () => {
    const csv = toCsv(["Name", "Note"], [["Atta, 5 kg", 'He said "fresh"'], ["Line\nbreak", ""]]);
    expect(parseCsv(csv)).toEqual([["Name", "Note"], ["Atta, 5 kg", 'He said "fresh"'], ["Line\nbreak", ""]]);
  });
  it("reads the free POS export headers", () => {
    const { records } = csvRecords('﻿Name,SKU,Selling Price,Tax %,Tax Type\r\nTea,T1,145,5,inclusive\r\n\r\n');
    expect(records).toEqual([{ name: "Tea", sku: "T1", sellingprice: "145", "tax%": "5", taxtype: "inclusive" }]);
  });
});

describe("ranges", () => {
  it("covers whole IST days", () => {
    const now = new Date("2026-11-04T20:00:00Z"); // already 5 Nov in India
    expect(presetDays("today", now, "Asia/Kolkata")).toEqual({ first: "2026-11-05", last: "2026-11-05" });
    expect(presetDays("7d", now, "Asia/Kolkata").first).toBe("2026-10-30");
    expect(presetDays("month", now, "Asia/Kolkata").first).toBe("2026-11-01");
    expect(toRange("2026-11-04", "2026-11-04", "Asia/Kolkata")).toEqual({ from: "2026-11-03T18:30:00.000Z", to: "2026-11-04T18:30:00.000Z" });
  });
});
