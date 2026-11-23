// Mobile twin of apps/web/src/components/analytics/frame.tsx. Keep the two in step.
import { fonts, MASKED_MONEY, OTHER } from "@money/shared";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type GestureResponderEvent, type LayoutChangeEvent, View } from "react-native";
import { Text as SvgText } from "react-native-svg";
import { select } from "../../lib/haptics";
import { isHidden } from "../../lib/privacy";
import type { Category } from "../../lib/queries";
import { c, cat } from "../../lib/theme";
import { T } from "../T";
import { SectionHeader } from "../ui";

/** One analytics block: title (with a note on the right), a headline sentence, then the chart. */
export function ChartSection({
  title,
  note,
  headline,
  children,
}: {
  title: string;
  note?: string;
  headline?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 14 }} accessibilityLabel={title}>
      <SectionHeader
        title={title}
        right={
          note ? (
            <T variant="caption" color={c.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
              {note}
            </T>
          ) : undefined
        }
      />
      {headline ? (
        <T variant="title" size={21}>
          {headline}
        </T>
      ) : null}
      {children}
    </View>
  );
}

/** Width of a view, from onLayout. 0 until measured; charts render nothing until then. */
export function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setWidth(Math.round(e.nativeEvent.layout.width));
  }, []);
  return [onLayout, width] as const;
}

/**
 * Touch-to-read for a chart. `pick` maps a touch point to an index (or null).
 * The selection ticks a haptic as it changes and clears a moment after release.
 * Vertical swipes still scroll the page.
 */
export function useScrub(pick: (x: number, y: number) => number | null) {
  const [sel, setSel] = useState<number | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef<number | null>(null);
  useEffect(() => () => void (clear.current && clearTimeout(clear.current)), []);

  const at = (e: GestureResponderEvent) => {
    if (clear.current) clearTimeout(clear.current);
    const i = pick(e.nativeEvent.locationX, e.nativeEvent.locationY);
    if (i !== last.current) {
      last.current = i;
      if (i !== null) select();
      setSel(i);
    }
  };
  const release = () => {
    clear.current = setTimeout(() => {
      last.current = null;
      setSel(null);
    }, 2500);
  };
  const handlers = {
    onStartShouldSetResponder: () => true,
    onMoveShouldSetResponder: () => true,
    onResponderGrant: at,
    onResponderMove: at,
    onResponderRelease: release,
    onResponderTerminate: release,
    onResponderTerminationRequest: () => true,
  };
  return { sel, handlers };
}

/** The line above a chart that reads out the touched item (or a default). */
export function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <T variant="small" color={c.textMuted} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </T>
      <T variant="title" size={18}>
        {value}
      </T>
    </View>
  );
}

const FAMILY = fonts.nativeFamily;

/**
 * SVG text in Space Grotesk. With `halo`, a background-colored outline is drawn
 * underneath so the label stays readable where it crosses marks.
 */
export function Label({
  x,
  y,
  children,
  size = 11,
  weight = 500,
  fill = c.textMuted,
  anchor = "start",
  halo = false,
}: {
  x: number;
  y: number;
  children: ReactNode;
  size?: number;
  weight?: 400 | 500 | 600 | 700;
  fill?: string;
  anchor?: "start" | "middle" | "end";
  halo?: boolean;
}) {
  const common = { x, y, fontSize: size, fontFamily: FAMILY[weight], textAnchor: anchor } as const;
  return (
    <>
      {halo && (
        <SvgText {...common} stroke={c.bg} strokeWidth={4} strokeLinejoin="round" fill={c.bg}>
          {children}
        </SvgText>
      )}
      <SvgText {...common} fill={fill}>
        {children}
      </SvgText>
    </>
  );
}

/** Nudges label positions apart so none are closer than `gap`, within [lo, hi]. */
export function spreadLabels<T extends { y: number }>(
  items: T[],
  gap: number,
  lo: number,
  hi: number,
): T[] {
  const s = [...items].sort((a, b) => a.y - b.y);
  s.forEach((it, i) => {
    it.y = Math.max(it.y, i ? (s[i - 1] as T).y + gap : lo);
  });
  for (let i = s.length - 1; i >= 0; i--) {
    const it = s[i] as T;
    it.y = Math.min(it.y, i < s.length - 1 ? (s[i + 1] as T).y - gap : hi);
  }
  return items;
}

export interface Series {
  key: string;
  name: string;
  color: string;
}

/** Name and color for a series key: a category id, or OTHER. Same category, same color, everywhere. */
export function seriesOf(key: string, byId: Map<string, Category>): Series {
  // Not "Other": that is a real category name too, and two "Other" rows read as a bug.
  if (key === OTHER) return { key, name: "The rest", color: cat("slate") };
  const x = byId.get(key);
  return { key, name: x ? x.name : "Unknown", color: cat(x?.color ?? "slate") };
}

/** Short month and date labels live in shared so every platform words them alike. */
export { shortDate, shortMonth } from "@money/shared";
/** Color blending lives with the theme; re-exported for the charts. */
export { fade, mix } from "../../lib/theme";

/** Compact money for ticks and tight labels: ₹950, ₹1.2k, ₹45k, ₹1.2L. */
// Callers also use useMoney, so they re-render when balances are hidden or shown.
export function compactMoney(minor: number): string {
  if (isHidden()) return MASKED_MONEY;
  const r = Math.round(minor / 100);
  if (r >= 100_000) return `₹${trim(r / 100_000)}L`;
  if (r >= 1000) return `₹${trim(r / 1000)}k`;
  return `₹${r}`;
}
const trim = (n: number) =>
  n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
