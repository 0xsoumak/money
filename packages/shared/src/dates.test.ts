import { describe, expect, it } from "vitest";
import { addMonths, isValidDate, isValidMonth, monthOf, monthRange, today } from "./dates";

describe("isValidDate", () => {
  it.each(["2026-11-10", "2024-02-29", "2026-12-31"])("accepts %s", (d) => {
    expect(isValidDate(d)).toBe(true);
  });
  it.each(["2026-02-29", "2026-13-01", "2026-04-31", "2026-1-5", "2026-11-00", "nope"])(
    "rejects %s",
    (d) => {
      expect(isValidDate(d)).toBe(false);
    },
  );
});

describe("isValidMonth", () => {
  it("validates YYYY-MM", () => {
    expect(isValidMonth("2026-11")).toBe(true);
    expect(isValidMonth("2026-00")).toBe(false);
    expect(isValidMonth("2026-1")).toBe(false);
  });
});

describe("addMonths", () => {
  it("handles year boundaries in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", -23)).toBe("2024-12");
    expect(addMonths("2026-11", 0)).toBe("2026-11");
  });
});

describe("monthRange", () => {
  it("returns an inclusive start and exclusive end", () => {
    expect(monthRange("2026-11")).toEqual({ start: "2026-11-01", end: "2026-12-01" });
    expect(monthRange("2026-12")).toEqual({ start: "2026-12-01", end: "2027-01-01" });
  });
});

describe("today / monthOf", () => {
  it("uses local calendar fields, not UTC", () => {
    // 11:30pm local on Nov 30 must stay Nov 30 regardless of the UTC offset.
    const lateNight = new Date(2026, 10, 30, 23, 30);
    expect(today(lateNight)).toBe("2026-11-30");
    expect(monthOf(today(lateNight))).toBe("2026-11");
  });
});
