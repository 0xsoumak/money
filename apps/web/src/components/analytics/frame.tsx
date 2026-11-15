import { OTHER } from "@money/shared";
import { type ReactNode, useCallback, useRef, useState } from "react";
import type { Category } from "../../lib/queries";
import { SectionHeader } from "../ui";

/**
 * One analytics block: uppercase title with a note on the right, a one-line
 * headline that says what the chart shows, then the chart.
 */
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
    <section aria-label={title} className="flex min-w-0 flex-col gap-4">
      <SectionHeader
        title={title}
        right={note ? <span className="text-sm text-muted">{note}</span> : undefined}
      />
      {headline && <p className="text-2xl font-bold tracking-[-0.02em] text-balance">{headline}</p>}
      {children}
    </section>
  );
}

/**
 * The element's content width, kept current as it resizes. Charts draw to this width.
 * A callback ref, so it re-attaches when the element is replaced (a chart that swaps to
 * an empty state and back). Zero readings, which a detached element reports, are ignored.
 */
export function useWidth<T extends HTMLElement>(fallback = 600) {
  const [width, setWidth] = useState(fallback);
  const observer = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!el) return;
    if (el.clientWidth > 0) setWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry?.contentRect.width ?? 0);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    observer.current = ro;
  }, []);
  return [ref, width] as const;
}

/** A floating label over a hovered mark, positioned in the chart's own pixels. */
export function ChartTip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm shadow-xl"
      style={{ left: x, top: y - 10 }}
    >
      {children}
    </div>
  );
}

/**
 * Nudges label positions apart so no two are closer than `gap`, keeping them
 * within [lo, hi]. Mutates and returns the items, which keep their order.
 */
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
  if (key === OTHER) return { key, name: "Other", color: "var(--cat-slate)" };
  const c = byId.get(key);
  return {
    key,
    name: c ? c.name : "Unknown",
    color: `var(--cat-${c?.color ?? "slate"})`,
  };
}

/** Short month and date labels live in shared so every platform words them alike. */
export { shortDate, shortMonth } from "@money/shared";

/** Compact money for axis ticks and tight labels: ₹950, ₹1.2k, ₹45k, ₹1.2L. */
export function compactMoney(minor: number): string {
  const r = Math.round(minor / 100);
  if (r >= 100_000) return `₹${trim(r / 100_000)}L`;
  if (r >= 1000) return `₹${trim(r / 1000)}k`;
  return `₹${r}`;
}
const trim = (n: number) =>
  n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();

/** Halo that keeps SVG text readable where it crosses marks. */
export const halo = {
  paintOrder: "stroke",
  stroke: "var(--bg)",
  strokeWidth: 5,
  strokeLinejoin: "round",
} as const;
