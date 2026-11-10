import { parseAmount } from "@money/shared";
import { describe, expect, it } from "vitest";
import { pressKey } from "./amount";

const type = (keys: string) => [...keys].reduce(pressKey, "");

describe("pressKey", () => {
  it("builds whole numbers", () => {
    expect(type("180")).toBe("180");
  });

  it("starts a decimal from nothing with a leading zero", () => {
    expect(type(".5")).toBe("0.5");
  });

  it("allows only one decimal point and two decimals", () => {
    expect(type("12.5.3")).toBe("12.53");
    expect(type("12.345")).toBe("12.34");
  });

  it("does not stack leading zeros", () => {
    expect(type("000")).toBe("0");
    expect(type("05")).toBe("5");
    expect(type("0.05")).toBe("0.05");
  });

  it("caps the whole part", () => {
    expect(type("12345678901")).toBe("123456789");
  });

  it("backspaces down to empty", () => {
    expect(pressKey("12.5", "Backspace")).toBe("12.");
    expect(pressKey("1", "Backspace")).toBe("");
    expect(pressKey("", "Backspace")).toBe("");
  });

  it("ignores other keys", () => {
    expect(pressKey("12", "a")).toBe("12");
    expect(pressKey("12", "Enter")).toBe("12");
  });

  it("always produces something parseAmount accepts", () => {
    for (const s of ["0.", "12.", "0.5", "999999999.99"]) {
      expect(parseAmount(s)).not.toBeNull();
    }
  });
});
