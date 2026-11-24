// The pieces every chart is built from, so they all read as one system:
// hairline grid, compact money ticks, one tooltip style, the same legend keys.
import { MASKED_MONEY } from "@money/shared";
import { type ReactNode, useCallback, useRef, useState } from "react";
import { isHidden } from "../../lib/privacy";
import { cx } from "../ui";

export { shortDate, shortMonth } from "@money/shared";

/** Compact money for ticks and tight labels: ₹950, ₹1.2k, ₹45k, ₹1.2L. */
// Callers also use useMoney, so they re-render when balances are hidden or shown.
export function compactMoney(minor: number): string {
  if (isHidden()) return MASKED_MONEY;
  const sign = minor < 0 ? "−" : "";
  const r = Math.round(Math.abs(minor) / 100);
  if (r >= 100_000) return `${sign}₹${trim(r / 100_000)}L`;
  if (r >= 1000) return `${sign}₹${trim(r / 1000)}k`;
  return `${sign}₹${r}`;
}
const trim = (n: number) =>
  n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();

/**
 * The element's content width, kept current as it resizes. Charts draw to this width.
 * A callback ref, so it re-attaches when the element is replaced. Zero readings, which a
 * detached element reports, are ignored.
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

/**
 * The one tooltip. Positioned in the chart's own pixels, above (x, y), and kept inside
 * the chart's width so it never spills off a narrow screen.
 */
export function ChartTip({
  x,
  y,
  width,
  children,
}: {
  x: number;
  y: number;
  /** The chart's width, to keep the tip inside it. */
  width: number;
  children: ReactNode;
}) {
  const edge = 90;
  const shift = x < edge ? "0%" : x > width - edge ? "-100%" : "-50%";
  return (
    <div
      role="presentation"
      className="pointer-events-none absolute z-10 flex min-w-36 flex-col gap-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-2xl"
      style={{ left: x, top: y - 12, transform: `translate(${shift}, -100%)` }}
    >
      {children}
    </div>
  );
}

/** Tooltip title: the month or day it describes. */
export function TipTitle({ children }: { children: ReactNode }) {
  return <span className="text-[13px] font-semibold text-muted">{children}</span>;
}

/** One tooltip row: a short key in the series' colour, the value strong, the name after. */
export function TipRow({
  swatch,
  value,
  name,
  tone,
}: {
  /** A Tailwind background class for the key, e.g. "bg-accent". Omit for a plain row. */
  swatch?: string;
  value: ReactNode;
  name: ReactNode;
  tone?: "danger" | "success";
}) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cx("h-[3px] w-3 shrink-0 rounded-full", swatch ?? "bg-transparent")}
      />
      <strong
        className={cx(
          "font-bold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </strong>
      <span className="text-muted">{name}</span>
    </span>
  );
}

type KeyShape = "bar" | "line" | "dash" | "band" | "dot" | "ring";

/** One legend entry. The key mirrors the mark: a block for bars, a stroke for lines. */
export function Key({
  shape = "bar",
  className,
  children,
}: {
  shape?: KeyShape;
  /** Colour classes for the key, e.g. "bg-accent" or "border-muted". */
  className: string;
  children: ReactNode;
}) {
  const key = {
    bar: "h-2.5 w-2.5 rounded-[3px]",
    band: "h-2.5 w-4 rounded-[3px]",
    line: "h-[2px] w-4 rounded-full",
    dash: "h-0 w-4 border-t-2 border-dashed",
    dot: "size-2.5 rounded-full",
    ring: "size-2.5 rounded-full border-2",
  }[shape];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span aria-hidden="true" className={cx("inline-block shrink-0", key, className)} />
      {children}
    </span>
  );
}

export function Legend({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">{children}</div>;
}

export type Tone = "warn" | "good" | "info";

/**
 * A chart card: a small title, a short takeaway in a few words, then the chart.
 * The takeaway is coloured only when it is a warning or good news.
 */
export function Panel({
  id,
  title,
  note,
  takeaway,
  tone = "info",
  className,
  children,
}: {
  id?: string;
  title: string;
  /** A few muted words on the right of the title, e.g. what the chart measures. */
  note?: string;
  takeaway?: ReactNode;
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cx(
        "flex min-w-0 scroll-mt-6 flex-col gap-5 rounded-xl border-2 border-line p-5 sm:p-6",
        className,
      )}
    >
      <header className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">{title}</h2>
          {note && <span className="text-sm text-muted">{note}</span>}
        </div>
        {takeaway && (
          <p
            className={cx(
              "text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl",
              tone === "warn" && "text-danger",
              tone === "good" && "text-accent",
            )}
          >
            {takeaway}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}
