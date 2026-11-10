import { describe, expect, it } from "vitest";
import { CATEGORY_COLORS } from "./schemas";
import {
  type ColorScheme,
  categoryColor,
  categoryColors,
  colors,
  MIN_TARGET,
  type ThemeColors,
} from "./tokens";

function luminance(hex: string): number {
  const channel = (i: number) => {
    const c = Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** WCAG 2.x contrast ratio. */
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const schemes: ColorScheme[] = ["dark", "light"];

describe.each(schemes)("%s theme contrast", (scheme) => {
  const t = colors[scheme];

  // Text that people must read: 4.5:1 on both the page and cards.
  it.each<[keyof ThemeColors]>([
    ["text"],
    ["textMuted"],
    ["accentText"],
    ["danger"],
    ["warning"],
    ["success"],
  ])("%s is readable on bg and surface", (key) => {
    expect(contrast(t[key], t.bg), `${key} on bg`).toBeGreaterThanOrEqual(4.5);
    expect(contrast(t[key], t.surface), `${key} on surface`).toBeGreaterThanOrEqual(4.5);
  });

  it("onAccent text is readable on the accent fill", () => {
    expect(contrast(t.onAccent, t.accent)).toBeGreaterThanOrEqual(4.5);
  });

  it("faint text stays at least 3:1 (placeholders only)", () => {
    expect(contrast(t.textFaint, t.bg)).toBeGreaterThanOrEqual(3);
  });

  it("every category color is a visible graphic (3:1) on bg and surface", () => {
    for (const [key, value] of Object.entries(categoryColors)) {
      expect(contrast(value[scheme], t.bg), `${key} on bg`).toBeGreaterThanOrEqual(3);
      expect(contrast(value[scheme], t.surface), `${key} on surface`).toBeGreaterThanOrEqual(3);
    }
  });

  it("unfilled meter blocks are distinguishable from the page", () => {
    expect(contrast(t.surfaceStrong, t.bg)).toBeGreaterThanOrEqual(1.2);
  });
});

describe("category colors", () => {
  it("covers exactly the keys the API accepts", () => {
    expect(Object.keys(categoryColors).sort()).toEqual([...CATEGORY_COLORS].sort());
  });

  it("falls back to slate for unknown keys", () => {
    expect(categoryColor("neon", "dark")).toBe(categoryColors.slate.dark);
  });
});

describe("layout", () => {
  it("keeps the touch target at 44", () => {
    expect(MIN_TARGET).toBe(44);
  });
});
