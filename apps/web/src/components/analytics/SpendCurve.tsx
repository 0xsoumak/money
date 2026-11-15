import type { SpendCurve as Curve } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { motion } from "motion/react";
import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import { ChartTip, compactMoney, halo, spreadLabels, useWidth } from "./frame";

const H = 270;
const TOP = 12;
const BOTTOM = 26;
const RIGHT = 104;

/**
 * Running total for the month against last month, the average of recent months
 * and the budget. Hover shows all three for a day.
 */
export function SpendCurve({ curve, budget }: { curve: Curve; budget: number | null }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);

  const plotW = Math.max(120, w - RIGHT);
  const span = Math.max(curve.days, curve.previous.length);
  const top = Math.max(
    curve.current.at(-1) ?? 0,
    curve.previous.at(-1) ?? 0,
    curve.average?.at(-1) ?? 0,
    budget ?? 0,
    1,
  );
  const x = scaleLinear().domain([1, span]).range([0, plotW]);
  const y = scaleLinear()
    .domain([0, top])
    .range([H - BOTTOM, TOP])
    .nice(4);
  const path = line<number>()
    .x((_, i) => x(i + 1))
    .y((v) => y(v));

  const ends = spreadLabels(
    [
      budget !== null && {
        y: y(budget) + 4,
        text: `Budget ${compactMoney(budget)}`,
        cls: "fill-muted",
      },
      curve.previous.length > 0 && {
        y: y(curve.previous.at(-1) ?? 0) + 4,
        text: `Last month ${compactMoney(curve.previous.at(-1) ?? 0)}`,
        cls: "fill-muted",
      },
      curve.average && {
        y: y(curve.average.at(-1) ?? 0) + 4,
        text: `Usual ${compactMoney(curve.average.at(-1) ?? 0)}`,
        cls: "fill-faint",
      },
    ].filter((e): e is { y: number; text: string; cls: string } => Boolean(e)),
    15,
    TOP,
    H - BOTTOM,
  );

  const last = curve.current.at(-1);
  const day = curve.elapsed;
  const ticks = [1, 8, 15, 22, 29].filter((d) => d <= span);

  const pick = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const d = Math.round(x.invert(e.clientX - box.left));
    setHover(Math.min(Math.max(d, 1), span));
  };
  const at = (arr: number[] | null | undefined, d: number) =>
    arr && d <= arr.length ? arr[d - 1] : undefined;

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`Running total by day. This month ${money(last ?? 0)} after ${day} days; last month ${money(curve.previous.at(-1) ?? 0)}${budget !== null ? `; budget ${money(budget)}` : ""}.`}
        className="block"
      >
        {y.ticks(4).map((t) => (
          <g key={t}>
            <line x1={0} x2={plotW} y1={y(t)} y2={y(t)} className="stroke-line" />
            <text x={0} y={y(t) - 5} className="fill-faint text-[11px]">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        {budget !== null && (
          <line
            x1={0}
            x2={plotW}
            y1={y(budget)}
            y2={y(budget)}
            className="stroke-muted"
            strokeWidth={1.5}
            strokeDasharray="2 4"
          />
        )}
        {curve.average && (
          <path
            d={path(curve.average) ?? ""}
            fill="none"
            className="stroke-faint"
            strokeWidth={2}
            strokeDasharray="5 4"
          />
        )}
        {curve.previous.length > 0 && (
          <path
            d={path(curve.previous) ?? ""}
            fill="none"
            className="stroke-muted"
            strokeWidth={2}
          />
        )}
        {curve.current.length > 1 && (
          <motion.path
            d={path(curve.current) ?? ""}
            fill="none"
            className="stroke-accent"
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
          />
        )}
        {last !== undefined && day > 0 && (
          <>
            <circle
              cx={x(day)}
              cy={y(last)}
              r={6}
              className="fill-accent stroke-bg"
              strokeWidth={2}
            />
            <text
              x={x(day) + (day > span * 0.6 ? -12 : 12)}
              y={y(last) - 10}
              textAnchor={day > span * 0.6 ? "end" : "start"}
              className="fill-ink text-sm font-bold"
              style={halo}
            >
              {money(last)}
            </text>
          </>
        )}
        {ends.map((e) => (
          <text key={e.text} x={plotW + 10} y={e.y} className={`${e.cls} text-xs font-semibold`}>
            {e.text}
          </text>
        ))}
        {ticks.map((d) => (
          <text
            key={d}
            x={Math.min(Math.max(x(d), 6), plotW - 6)}
            y={H - 6}
            textAnchor="middle"
            className="fill-faint text-[11px]"
          >
            {d}
          </text>
        ))}
        {hover !== null && (
          <line x1={x(hover)} x2={x(hover)} y1={TOP} y2={H - BOTTOM} className="stroke-ink/40" />
        )}
        <rect
          x={0}
          y={0}
          width={plotW}
          height={H - BOTTOM}
          fill="transparent"
          onPointerMove={pick}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <ChartTip x={x(hover)} y={TOP + 20}>
          <span className="font-bold">Day {hover}</span>
          <span className="ml-3 text-muted">This month</span>{" "}
          <strong>
            {at(curve.current, hover) !== undefined ? money(at(curve.current, hover) ?? 0) : "–"}
          </strong>
          <span className="ml-3 text-muted">Last</span>{" "}
          <strong>{money(at(curve.previous, hover) ?? curve.previous.at(-1) ?? 0)}</strong>
          {curve.average && (
            <>
              <span className="ml-3 text-muted">Usual</span>{" "}
              <strong>{money(at(curve.average, hover) ?? 0)}</strong>
            </>
          )}
        </ChartTip>
      )}
    </div>
  );
}
