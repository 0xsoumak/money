import { categoryColor, colors, radius, space } from "@money/shared";

/** Dark only for now, same tokens as the web app. */
export const c = colors.dark;
export { radius, space };

export const cat = (key: string) => categoryColor(key, "dark");

/** Minimum touch target. */
export const TARGET = 44;

/** Blend two #rrggbb colors: t = 0 gives `a`, 1 gives `b`. RN has no color-mix(). */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string, i: number) => Number.parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) =>
    Math.round(p(a, i) + (p(b, i) - p(a, i)) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

/** A #rrggbb color at the given opacity, blended over the background. */
export const fade = (color: string, opacity: number) => mix(c.bg, color, opacity);

/**
 * The one way a category color fills something: a soft tint with a stronger edge, never
 * a solid block (solid fills next to each other are loud). Used for category tiles and for
 * a selected category chip; the text on top stays the normal ink.
 */
export const catTint = (key: string) => {
  const color = cat(key);
  return { backgroundColor: fade(color, 0.2), borderColor: fade(color, 0.55) };
};
