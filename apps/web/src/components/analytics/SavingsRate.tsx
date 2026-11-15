import type { SavingsMonth } from "@money/shared";
import { scaleLinear, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import { ChartTip, halo, shortMonth, useWidth } from "./frame";

const H = 230;
const TOP = 16;
const BOTTOM = 28;
const RIGHT = 64;

const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Share of income invested each month; the latest month in lime, a dashed line at the average. */
export function SavingsRate({ months }: { months: SavingsMonth[] }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);
  const points = months
    .map((m, i) => ({ ...m, i }))
    .filter((m): m is SavingsMonth & { i: number; rate: number } => m.rate !== null);

  if (points.length === 0) {
    return <p className="border-b border-line py-8 text-muted">No income logged in this range.</p>;
  }

  const plotW = w - RIGHT;
  const x = scalePoint<number>()
    .domain(months.map((_, i) => i))
    .range([10, plotW - 10]);
  const top = Math.max(0.4, ...points.map((p) => p.rate));
  const y = scaleLinear()
    .domain([0, top])
    .range([H - BOTTOM, TOP])
    .nice(4);
  const path = line<(typeof points)[number]>()
    .x((p) => x(p.i) ?? 0)
    .y((p) => y(p.rate));
  const avg = points.reduce((t, p) => t + p.rate, 0) / points.length;
  const last = points.at(-1) as (typeof points)[number];
  const every = months.length > 6 ? 2 : 1;
  const hovered = hover === null ? null : points.find((p) => p.i === hover);

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`Share of income invested: ${points.map((p) => `${shortMonth(p.month)} ${pct(p.rate)}`).join(", ")}.`}
        className="block"
        onPointerLeave={() => setHover(null)}
      >
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} className="stroke-line" />
            <text x={0} y={y(t) - 5} className="fill-faint text-[11px]">
              {pct(t)}
            </text>
          </g>
        ))}
        <line
          x1={0}
          x2={plotW}
          y1={y(avg)}
          y2={y(avg)}
          className="stroke-faint"
          strokeWidth={1.5}
          strokeDasharray="5 4"
        />
        <text x={plotW + 8} y={y(avg) + 4} className="fill-muted text-xs">
          avg {pct(avg)}
        </text>
        <path
          d={path(points) ?? ""}
          fill="none"
          className="stroke-ink"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {points.map((p) => {
          const isLast = p === last;
          return (
            <circle
              key={p.month}
              cx={x(p.i)}
              cy={y(p.rate)}
              r={isLast ? 7 : hover === p.i ? 6 : 4}
              className={isLast ? "fill-accent stroke-bg" : "fill-ink stroke-bg"}
              strokeWidth={2}
            />
          );
        })}
        <text
          x={(x(last.i) ?? 0) - 12}
          y={y(last.rate) - 12}
          textAnchor="end"
          className="fill-ink text-[15px] font-bold"
          style={halo}
        >
          {pct(last.rate)}
        </text>
        {months.map((m, i) =>
          (months.length - 1 - i) % every === 0 ? (
            <text
              key={m.month}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {shortMonth(m.month)}
            </text>
          ) : null,
        )}
        {months.map((m, i) => (
          <rect
            key={m.month}
            x={(x(i) ?? 0) - x.step() / 2}
            y={0}
            width={x.step()}
            height={H - BOTTOM}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && (
        <ChartTip x={x(hovered.i) ?? 0} y={y(hovered.rate)}>
          <span className="text-muted">{shortMonth(hovered.month)}</span>{" "}
          <strong>{pct(hovered.rate)}</strong>
          <span className="ml-2 text-muted">
            {money(hovered.invested)} of {money(hovered.income)}
          </span>
        </ChartTip>
      )}
    </div>
  );
}
