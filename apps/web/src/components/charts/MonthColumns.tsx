import { monthTitle } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { motion } from "motion/react";
import { type ReactNode, useState } from "react";
import { cx } from "../ui";
import { ChartTip, columnPath, halo, shortMonth, TipTitle, useWidth, YGrid } from "./kit";

/** One stacked piece of a column, drawn bottom to top. */
export interface ColumnPart {
  value: number;
  /** SVG fill class, e.g. "fill-accent". */
  className: string;
}

export interface Column {
  month: string;
  parts: ColumnPart[];
  current?: boolean;
  /** A dashed outline above the column, up to this total: where a running month may end. */
  ghost?: number;
  /** A short bar across the slot at this value, e.g. income. */
  marker?: number;
  /** Draw an empty dashed slot: nothing happened, and that matters (a missed investment). */
  missing?: boolean;
  /** Printed above the column. Use sparingly: the current month, an extreme. */
  label?: string;
  /** A second line under the month name. */
  sub?: ReactNode;
  /** Tooltip rows. The month is added as the title. */
  tip: ReactNode;
  /** What a screen reader hears for this column. */
  aria: string;
}

const TOP = 22;
const GAP = 2;

/**
 * Months as columns on one baseline. Optional extras: a shaded band (the usual range),
 * a limit line (the budget), a marker per column (income), a dashed ghost (projection).
 * Each column is a hover and focus target with its own tooltip.
 */
export function MonthColumns({
  columns,
  band,
  limit,
  height = 200,
}: {
  columns: Column[];
  band?: { low: number; high: number } | null;
  limit?: { value: number; label: string } | null;
  height?: number;
}) {
  const [ref, w] = useWidth<HTMLDivElement>(600);
  const [hover, setHover] = useState<number | null>(null);

  const total = (c: Column) => c.parts.reduce((t, p) => t + p.value, 0);
  const max = Math.max(
    1,
    ...columns.map((c) => Math.max(total(c), c.ghost ?? 0, c.marker ?? 0)),
    band?.high ?? 0,
    limit?.value ?? 0,
  );
  const y = scaleLinear()
    .domain([0, max * 1.05])
    .range([height, TOP])
    .nice(3);
  const base = y(0);
  const slot = w / Math.max(columns.length, 1);
  const barW = Math.max(8, Math.min(24, slot * 0.56));
  const cxOf = (i: number) => slot * i + slot / 2;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div ref={ref} className="relative w-full">
        <svg width={w} height={height + 1} className="block overflow-visible">
          <YGrid y={y} width={w} />

          {band && band.high > 0 && (
            <rect
              x={0}
              width={w}
              y={y(band.high)}
              height={Math.max(2, y(band.low) - y(band.high))}
              className="fill-ink/[0.07]"
            />
          )}

          {limit && (
            <g>
              <line
                x1={0}
                x2={w}
                y1={y(limit.value)}
                y2={y(limit.value)}
                className="stroke-ink/60"
                strokeWidth={1}
              />
              <text
                x={w}
                y={y(limit.value) - 6}
                textAnchor="end"
                className="fill-ink text-[11px] font-semibold"
                style={halo}
              >
                {limit.label}
              </text>
            </g>
          )}

          {columns.map((c, i) => {
            const x0 = cxOf(i) - barW / 2;
            const t = total(c);
            const dim = hover !== null && hover !== i;
            // Stack bottom to top with a 2px gap between pieces; only the top piece is rounded.
            const drawn = c.parts.filter((p) => p.value > 0);
            let acc = base;
            const pieces = drawn.map((p, k) => {
              const h = Math.max(2, base - y(p.value));
              const top = acc - h;
              const piece = {
                d:
                  k === drawn.length - 1
                    ? columnPath(x0, top, barW, h)
                    : `M${x0},${top}h${barW}v${h}h${-barW}Z`,
                className: p.className,
              };
              acc = top - GAP;
              return piece;
            });
            const stackTop = drawn.length ? acc + GAP : base;
            const ghostTop = c.ghost && c.ghost > t ? y(c.ghost) : null;
            const labelY = Math.min(stackTop, ghostTop ?? stackTop, c.marker ? y(c.marker) : base);

            return (
              <g
                key={c.month}
                className="transition-opacity duration-200"
                style={{ opacity: dim ? 0.4 : 1 }}
              >
                {c.missing ? (
                  <rect
                    x={x0}
                    y={base - (base - TOP) * 0.3}
                    width={barW}
                    height={(base - TOP) * 0.3}
                    rx={4}
                    fill="none"
                    className="stroke-line-strong/30"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                ) : (
                  <motion.g
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{ duration: 0.5, delay: i * 0.03, ease: [0.2, 0, 0, 1] }}
                    style={{ originY: 1, transformBox: "fill-box" }}
                  >
                    {pieces.map((p, k) => (
                      <path key={k} d={p.d} className={p.className} />
                    ))}
                  </motion.g>
                )}
                {ghostTop !== null && (
                  <path
                    d={columnPath(x0, ghostTop, barW, stackTop - GAP - ghostTop)}
                    fill="none"
                    className="stroke-line-strong/45"
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                )}
                {c.marker !== undefined && c.marker > 0 && (
                  <line
                    x1={cxOf(i) - Math.min(slot * 0.4, barW)}
                    x2={cxOf(i) + Math.min(slot * 0.4, barW)}
                    y1={y(c.marker)}
                    y2={y(c.marker)}
                    className="stroke-ink"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                )}
                {c.label && (
                  <text
                    x={cxOf(i)}
                    y={labelY - 7}
                    textAnchor="middle"
                    className="fill-ink text-xs font-bold"
                    style={halo}
                  >
                    {c.label}
                  </text>
                )}
                <rect
                  x={slot * i}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  tabIndex={0}
                  role="img"
                  aria-label={c.aria}
                  className="outline-none"
                  onPointerEnter={() => setHover(i)}
                  onPointerDown={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>

        {hover !== null && columns[hover] && (
          <ChartTip
            x={cxOf(hover)}
            y={Math.min(
              y(total(columns[hover])),
              y(columns[hover].ghost ?? 0),
              y(columns[hover].marker ?? 0),
            )}
            width={w}
          >
            <TipTitle>{monthTitle(columns[hover].month)}</TipTitle>
            {columns[hover].tip}
          </ChartTip>
        )}
      </div>

      <ul className="flex text-xs font-semibold text-muted">
        {columns.map((c, i) => (
          <li
            key={c.month}
            className={cx(
              "min-w-0 flex-1 text-center transition-colors",
              (c.current || hover === i) && "text-ink",
              c.current && "font-bold",
            )}
          >
            <span className="block truncate">{shortMonth(c.month)}</span>
            {c.sub && <span className="block truncate font-normal">{c.sub}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}
