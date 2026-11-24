import { type PaceDay, type Range, shortDate } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { area, curveMonotoneX, line } from "d3-shape";
import { motion } from "motion/react";
import { type KeyboardEvent, type PointerEvent, useState } from "react";
import { useMoney } from "../../lib/hooks";
import { ease } from "../motion";
import {
  ChartTip,
  compactMoney,
  halo,
  Key,
  Legend,
  spreadLabels,
  TipRow,
  TipTitle,
  useWidth,
  YGrid,
} from "./kit";

const TOP = 18;
const BOTTOM = 26;

/**
 * The month so far as a running total, over the shaded range earlier months had reached
 * by each day. A dashed line carries it on to where the month is likely to end, and a
 * hairline marks the budget. Hover or arrow keys read out any day.
 */
export function PaceChart({
  month,
  current,
  days,
  usual,
  projected,
  budget,
  height = 260,
}: {
  month: string;
  /** Running total, day 1 to today. */
  current: number[];
  days: number;
  /** The usual running total for every day; null without history. */
  usual: PaceDay[] | null;
  /** Where a running month is likely to land; null once it's over. */
  projected: Range | null;
  budget: number | null;
  height?: number;
}) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(640);
  const [hover, setHover] = useState<number | null>(null);

  const right = w < 420 ? 64 : 92;
  const plotW = Math.max(160, w - right);
  const elapsed = current.length;
  const last = current.at(-1) ?? 0;
  const showProjection = projected !== null && elapsed > 0 && elapsed < days;

  const top = Math.max(
    last,
    usual?.at(-1)?.high ?? 0,
    showProjection ? projected.high : 0,
    budget ?? 0,
    1,
  );
  const x = scaleLinear().domain([1, days]).range([0, plotW]);
  const y = scaleLinear()
    .domain([0, top * 1.04])
    .range([height - BOTTOM, TOP])
    .nice(3);

  const band = area<PaceDay>()
    .x((_, i) => x(i + 1))
    .y0((d) => y(d.low))
    .y1((d) => y(d.high))
    .curve(curveMonotoneX);
  const mid = line<PaceDay>()
    .x((_, i) => x(i + 1))
    .y((d) => y(d.mid))
    .curve(curveMonotoneX);
  const run = line<number>()
    .x((_, i) => x(i + 1))
    .y((v) => y(v))
    .curve(curveMonotoneX);
  const wash = area<number>()
    .x((_, i) => x(i + 1))
    .y0(y(0))
    .y1((v) => y(v))
    .curve(curveMonotoneX);

  // Labels at the right edge, nudged apart when they'd collide.
  type End = { y: number; text: string; cls: string };
  const ends = spreadLabels(
    [
      budget !== null && {
        y: y(budget) + 4,
        text: `Budget ${compactMoney(budget)}`,
        cls: "fill-ink font-semibold",
      },
      showProjection && {
        y: y(projected.mid) + 4,
        text: `Likely ${compactMoney(projected.mid)}`,
        cls: "fill-muted font-semibold",
      },
      usual && {
        y: y(usual.at(-1)?.mid ?? 0) + 4,
        text: `Usual ${compactMoney(usual.at(-1)?.mid ?? 0)}`,
        cls: "fill-faint font-semibold",
      },
    ].filter((e): e is End => Boolean(e)),
    16,
    TOP,
    height - BOTTOM,
  );

  const ticks = [1, 8, 15, 22, days];
  const date = (d: number) => shortDate(`${month}-${String(d).padStart(2, "0")}`);
  const likelyOn = (d: number) =>
    showProjection && d > elapsed
      ? Math.round(last + ((projected.mid - last) * (d - elapsed)) / (days - elapsed))
      : null;

  const pick = (e: PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const d = Math.round(x.invert(e.clientX - box.left));
    setHover(Math.min(Math.max(d, 1), days));
  };
  const keys = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const start = hover ?? Math.max(elapsed, 1);
    setHover(Math.min(Math.max(start + (e.key === "ArrowLeft" ? -1 : 1), 1), days));
  };

  const hu = hover !== null ? usual?.[hover - 1] : undefined;
  const hNow = hover !== null && hover <= elapsed ? current[hover - 1] : undefined;
  const hLikely = hover !== null ? likelyOn(hover) : null;
  const hoverY = hNow ?? hLikely ?? hu?.mid ?? 0;

  const summary = [
    `Spent ${money(last)} by ${date(Math.max(elapsed, 1))}.`,
    usual && elapsed > 0
      ? `Usually ${money(usual[elapsed - 1]?.low ?? 0)} to ${money(usual[elapsed - 1]?.high ?? 0)} by then.`
      : "",
    showProjection ? `Likely ${money(projected.mid)} by month end.` : "",
    budget !== null ? `Budget ${money(budget)}.` : "",
  ].join(" ");

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div ref={ref} className="relative w-full">
        <svg
          width={w}
          height={height}
          role="img"
          aria-label={summary}
          tabIndex={0}
          onKeyDown={keys}
          onBlur={() => setHover(null)}
          className="block rounded-md outline-offset-4"
        >
          <YGrid y={y} width={plotW} />

          {usual && (
            <>
              <path d={band(usual) ?? ""} className="fill-ink/[0.08]" />
              <path d={mid(usual) ?? ""} fill="none" className="stroke-ink/25" strokeWidth={1} />
            </>
          )}

          {budget !== null && (
            <line
              x1={0}
              x2={plotW}
              y1={y(budget)}
              y2={y(budget)}
              className="stroke-ink/60"
              strokeWidth={1}
            />
          )}

          {showProjection && (
            <>
              <path
                d={`M${x(elapsed)},${y(last)} L${x(days)},${y(projected.low)} L${x(days)},${y(projected.high)} Z`}
                className="fill-accent/[0.08]"
              />
              <line
                x1={x(elapsed)}
                y1={y(last)}
                x2={x(days)}
                y2={y(projected.mid)}
                className="stroke-accent/70"
                strokeWidth={2}
                strokeDasharray="4 5"
                strokeLinecap="round"
              />
            </>
          )}

          {elapsed > 1 && (
            <>
              <motion.path
                d={wash(current) ?? ""}
                className="fill-accent/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
              />
              <motion.path
                d={run(current) ?? ""}
                fill="none"
                className="stroke-accent"
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 0.8, ease }}
              />
            </>
          )}

          {elapsed > 0 && (
            <>
              <circle
                cx={x(elapsed)}
                cy={y(last)}
                r={5}
                className="fill-accent stroke-bg"
                strokeWidth={2}
              />
              <text
                x={x(elapsed) + (elapsed > days * 0.6 ? -10 : 10)}
                y={y(last) - 12}
                textAnchor={elapsed > days * 0.6 ? "end" : "start"}
                className="fill-ink text-sm font-bold"
                style={halo}
              >
                {compactMoney(last)}
              </text>
            </>
          )}

          {ends.map((e) => (
            <text key={e.text} x={plotW + 10} y={e.y} className={`${e.cls} text-xs`}>
              {e.text}
            </text>
          ))}

          {ticks.map((d, i) => (
            <text
              key={d}
              x={x(d)}
              y={height - 6}
              textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}
              className="fill-faint text-[11px]"
            >
              {d}
            </text>
          ))}

          {hover !== null && (
            <g aria-hidden="true">
              <line
                x1={x(hover)}
                x2={x(hover)}
                y1={TOP}
                y2={height - BOTTOM}
                className="stroke-ink/40"
              />
              <circle
                cx={x(hover)}
                cy={y(hoverY)}
                r={4}
                className={hNow !== undefined ? "fill-accent stroke-bg" : "fill-ink stroke-bg"}
                strokeWidth={2}
              />
            </g>
          )}

          <rect
            x={0}
            y={0}
            width={plotW}
            height={height - BOTTOM}
            fill="transparent"
            onPointerMove={pick}
            onPointerDown={pick}
            onPointerLeave={() => setHover(null)}
          />
        </svg>

        {hover !== null && (
          <ChartTip x={x(hover)} y={Math.min(y(hoverY), y(hu?.high ?? 0))} width={plotW}>
            <TipTitle>{date(hover)}</TipTitle>
            {hNow !== undefined && <TipRow swatch="bg-accent" value={money(hNow)} name="spent" />}
            {hLikely !== null && (
              <TipRow swatch="bg-accent/60" value={money(hLikely)} name="likely" />
            )}
            {hu && (
              <TipRow
                swatch="bg-ink/30"
                value={`${compactMoney(hu.low)}–${compactMoney(hu.high)}`}
                name="usual"
              />
            )}
            {budget !== null && <TipRow swatch="bg-ink/60" value={money(budget)} name="budget" />}
          </ChartTip>
        )}
      </div>

      <Legend>
        <Key shape="line" className="bg-accent">
          This month
        </Key>
        {usual && (
          <Key shape="band" className="bg-ink/15">
            Your usual range
          </Key>
        )}
        {showProjection && (
          <Key shape="dash" className="border-accent/70">
            Likely
          </Key>
        )}
        {budget !== null && (
          <Key shape="line" className="bg-ink/60">
            Budget
          </Key>
        )}
      </Legend>
    </figure>
  );
}
