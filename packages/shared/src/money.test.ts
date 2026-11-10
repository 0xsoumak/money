import { describe, expect, it } from "vitest";
import { formatMoney, MAX_MINOR, parseAmount, toDecimalString } from "./money";

describe("parseAmount", () => {
  it.each([
    ["125", 12500],
    ["125.5", 12550],
    ["125.50", 12550],
    ["0.29", 29],
    ["0.1", 10],
    ["1,250.75", 125075],
    [" 42 ", 4200],
    ["7.", 700],
    ["0", 0],
  ])("parses %j → %d", (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.234", "1e3", "12.3.4", ".5"])("rejects %j", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("rejects amounts above the max", () => {
    expect(parseAmount(String(MAX_MINOR / 100 + 1))).toBeNull();
  });
});

describe("toDecimalString", () => {
  it("formats minor units exactly", () => {
    expect(toDecimalString(12550)).toBe("125.50");
    expect(toDecimalString(5)).toBe("0.05");
    expect(toDecimalString(-199)).toBe("-1.99");
  });
});

describe("formatMoney", () => {
  it("formats INR with Indian grouping and trims .00", () => {
    expect(formatMoney(12345600)).toBe("₹1,23,456");
    expect(formatMoney(12550)).toBe("₹125.50");
  });

  it("supports other currencies", () => {
    expect(formatMoney(12550, { currency: "USD", locale: "en-US" })).toBe("$125.50");
  });
});
