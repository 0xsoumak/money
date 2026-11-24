import { describe, expect, it } from "vitest";
import { shortDate, shortMonth, weekdayHeadline } from "./chartLabels";

describe("labels", () => {
  it("formats months and dates without timezones", () => {
    expect(shortMonth("2026-11")).toBe("Nov");
    expect(shortDate("2026-11-07")).toBe("Sat, 7 Nov");
  });
});

describe("weekdayHeadline", () => {
  it("calls out pricey weekends", () => {
    expect(weekdayHeadline([100, 100, 100, 100, 100, 200, 200])).toBe(
      "Weekends cost 2× a weekday.",
    );
    expect(weekdayHeadline([100, 100, 100, 100, 100, 100, 100])).toBe(
      "Spending is even across the week.",
    );
  });
});
