/**
 * Design tokens for the "Bold & high-contrast" direction.
 *
 * Platform neutral on purpose: plain numbers and hex strings, no CSS units, so
 * Tailwind (web) and NativeWind/StyleSheet (mobile) read the same source.
 * Dark is the primary look; light is the same design on a warm off-white.
 */

export type ColorScheme = "dark" | "light";

export interface ThemeColors {
  /** App background. */
  bg: string;
  /** Cards, inputs, keypad keys. */
  surface: string;
  /** Hover / pressed / unfilled meter blocks. */
  surfaceStrong: string;
  /** Hairline dividers between rows. */
  border: string;
  /** Outlines on buttons and fields; the header rule. */
  borderStrong: string;
  text: string;
  textMuted: string;
  /** Placeholders and disabled text. Not for anything the user must read. */
  textFaint: string;
  /** Fills: primary button, FAB, selected states. */
  accent: string;
  /** Text and icons placed ON an accent fill. */
  onAccent: string;
  /** The accent used AS text or a thin line. Lime fails contrast on light backgrounds, so it differs there. */
  accentText: string;
  /** Over budget, errors. Always paired with words, never color alone. */
  danger: string;
  /** Approaching a limit. */
  warning: string;
  success: string;
}

export const colors: Record<ColorScheme, ThemeColors> = {
  dark: {
    bg: "#0B0B0C",
    surface: "#1A1A1C",
    surfaceStrong: "#2A2A2C",
    border: "#2A2A2C",
    borderStrong: "#F4F4F0",
    text: "#F4F4F0",
    textMuted: "#9A9A94",
    textFaint: "#6E6E69",
    accent: "#C6F432",
    onAccent: "#0B0B0C",
    accentText: "#C6F432",
    danger: "#FF6B5B",
    warning: "#FFD23F",
    success: "#4FE3A8",
  },
  light: {
    bg: "#F4F4F0",
    surface: "#FFFFFF",
    surfaceStrong: "#D6D6CE",
    border: "#E1E1DA",
    borderStrong: "#0B0B0C",
    text: "#0B0B0C",
    textMuted: "#5C5C57",
    textFaint: "#8C8C86",
    accent: "#C6F432",
    onAccent: "#0B0B0C",
    accentText: "#4C6A00",
    danger: "#C4321F",
    warning: "#8A6400",
    success: "#0A7A52",
  },
};

/**
 * Category colors, keyed by the same names the API stores (CATEGORY_COLORS).
 * Each has a variant tuned per scheme: bright on dark, deeper on light, so a
 * bar or swatch keeps at least 3:1 against its surface in both.
 */
export const categoryColors = {
  coral: { dark: "#FF7A59", light: "#D9441F" },
  amber: { dark: "#FFD23F", light: "#B88400" },
  lime: { dark: "#C6F432", light: "#6E9A00" },
  mint: { dark: "#4FE3A8", light: "#0E9D68" },
  teal: { dark: "#2FD4C8", light: "#0A8F88" },
  sky: { dark: "#59D2FF", light: "#1B7FC4" },
  indigo: { dark: "#8C9EFF", light: "#4B5FD6" },
  violet: { dark: "#B79BFF", light: "#7B52D9" },
  pink: { dark: "#FF8AC7", light: "#C72C87" },
  slate: { dark: "#A8ADB5", light: "#5E6670" },
} as const satisfies Record<string, Record<ColorScheme, string>>;

export type CategoryColorKey = keyof typeof categoryColors;

export function categoryColor(key: string, scheme: ColorScheme): string {
  const entry = categoryColors[key as CategoryColorKey] ?? categoryColors.slate;
  return entry[scheme];
}

/** 4px base scale. Use these, not ad-hoc numbers. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** Corners are tight and confident. Cards use md/lg; chips and buttons sm/md. */
export const radius = {
  xs: 3, // meter blocks
  sm: 6,
  md: 10,
  lg: 14,
  xl: 18,
  pill: 999,
} as const;

/** Minimum touch target on every platform. */
export const MIN_TARGET = 44;

export const fonts = {
  /** Space Grotesk. Load 400, 500, 600, 700. */
  family: "Space Grotesk",
  /** Native font files need one family name per weight. */
  nativeFamily: {
    400: "SpaceGrotesk_400Regular",
    500: "SpaceGrotesk_500Medium",
    600: "SpaceGrotesk_600SemiBold",
    700: "SpaceGrotesk_700Bold",
  },
} as const;

/**
 * Type scale. Money is always set with tabular figures
 * (`font-variant-numeric: tabular-nums` / RN `fontVariant: ["tabular-nums"]`)
 * so digits don't jump as values change.
 */
export const type = {
  /** The month's headline total. Web: 112, phone: 76. */
  displayXl: { size: 112, lineHeight: 0.9, weight: 700, tracking: -0.06 },
  display: { size: 76, lineHeight: 0.95, weight: 700, tracking: -0.05 },
  /** The amount being typed in quick add. */
  amount: { size: 96, lineHeight: 0.95, weight: 700, tracking: -0.06 },
  title: { size: 36, lineHeight: 1.1, weight: 700, tracking: -0.02 },
  /** Row amount. */
  rowAmount: { size: 20, lineHeight: 1.2, weight: 700, tracking: 0 },
  /** Row title. */
  body: { size: 18, lineHeight: 1.3, weight: 600, tracking: 0 },
  small: { size: 14, lineHeight: 1.3, weight: 500, tracking: 0 },
  /** Uppercase section labels and buttons. */
  label: { size: 14, lineHeight: 1.2, weight: 700, tracking: 0.12, uppercase: true },
  caption: { size: 13, lineHeight: 1.3, weight: 500, tracking: 0 },
} as const;

/** Flat design: separation comes from borders and contrast, not shadows. */
export const borderWidth = { hairline: 1, strong: 2 } as const;

export const motion = {
  /** ms */
  duration: { instant: 90, quick: 160, base: 240, slow: 400 },
  /** Springs for sheets, keypad press, undo toast. Same feel on web (Motion) and mobile (Reanimated). */
  spring: { stiffness: 380, damping: 30, mass: 1 },
} as const;

/** Chart and meter rules, so every visualization looks like it belongs. */
export const dataviz = {
  /** The signature meter: this many equal blocks, filled left to right. */
  meterBlocks: 10,
  meterBlockHeight: 14,
  meterGap: 3,
  /** Share-of-spend bar: one segment per category, tallest element on the screen after the total. */
  shareBarHeight: 40,
  shareBarGap: 4,
  /** Over 80% of a budget turns the meter fill to `warning`; over 100% to `danger`. */
  warnAt: 0.8,
  overAt: 1,
} as const;
