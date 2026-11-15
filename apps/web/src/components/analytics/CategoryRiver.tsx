import type { CategoryMix } from "@money/shared";
import { scaleLinear, scalePoint } from "d3-scale";
import { area, curveMonotoneX, stack, stackOffsetSilhouette, stackOrderNone } from "d3-shape";
import { motion } from "motion/react";
import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { tween } from "../motion";
import { ChartTip, compactMoney, seriesOf, shortMonth, spreadLabels, useWidth } from "./frame";

const H = 300;
const BOTTOM = 26;

type Datum = Record<string, number>;

/**
 * Streamgraph of monthly spending by category: each band's thickness is the
 * amount, centred on a common midline so changes in mix stand out. Labelled
 * at the right edge; hover a month for its numbers.
 */
export function CategoryRiver({ mix, byId }: { mix: CategoryMix; byId: Map<string, Category> }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(1100);
  const [hover, setHover] = useState<number | null>(null);

  if (mix.keys.length === 0 || mix.months.every((m) => m.total === 0)) {
    return <p className="border-b border-line py-8 text-muted">No spending in this range.</p>;
  }

  const narrow = w < 720;
  const labelW = narrow ? 96 : 170;
  const plotW = w - labelW - 12;
  const series = mix.keys.map((k) => seriesOf(k, byId));
  const data: Datum[] = mix.months.map((m) => ({ ...m.values }));
  const layers = stack<Datum>().keys(mix.keys).offset(stackOffsetSilhouette).order(stackOrderNone)(
    data,
  );

  const x = scalePoint<number>()
    .domain(mix.months.map((_, i) => i))
    .range([4, plotW]);
  const maxTotal = Math.max(...mix.months.map((m) => m.total), 1);
  const y = scaleLinear()
    .domain([-maxTotal / 2, maxTotal / 2])
    .range([H - BOTTOM - 6, 6]);
  const shape = area<[number, number]>()
    .x((_, i) => x(i) ?? 0)
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(curveMonotoneX);

  const lastI = mix.months.length - 1;
  const labels = spreadLabels(
    layers.map((layer, i) => {
      const d = layer[lastI] as unknown as [number, number];
      const s = series[i] as (typeof series)[number];
      return {
        key: s.key,
        name: s.name,
        value: compactMoney(mix.months[lastI]?.values[s.key] ?? 0),
        anchor: (y(d[0]) + y(d[1])) / 2,
        y: (y(d[0]) + y(d[1])) / 2 + 4,
      };
    }),
    18,
    10,
    H - BOTTOM,
  );
  const step = mix.months.length > 1 ? plotW / (mix.months.length - 1) : plotW;
  const every = mix.months.length > 8 && narrow ? 2 : 1;
  const hovered = hover === null ? null : mix.months[hover];

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`Monthly spending by category, ${mix.months.length} months. ${series
          .map((s) => `${s.name} ${money(mix.months[lastI]?.values[s.key] ?? 0)} in the last month`)
          .join(", ")}.`}
        className="block"
        onPointerLeave={() => setHover(null)}
      >
        {layers.map((layer, i) => (
          <motion.path
            key={layer.key}
            d={shape(layer as unknown as [number, number][]) ?? ""}
            className="stroke-bg"
            strokeWidth={2}
            strokeLinejoin="round"
            style={{ fill: series[i]?.color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: hovered === null ? 1 : 0.85 }}
            transition={{ ...tween.slow, delay: 0.05 * i }}
          />
        ))}
        {hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={0}
            y2={H - BOTTOM}
            className="stroke-ink"
            strokeWidth={1.5}
          />
        )}
        {labels.map((l) => (
          <g key={l.key}>
            <line
              x1={plotW + 2}
              x2={plotW + 12}
              y1={l.anchor}
              y2={l.y - 4}
              className="stroke-faint"
            />
            <text x={plotW + 16} y={l.y} className="fill-ink text-[13px] font-semibold">
              {l.name}
            </text>
            {!narrow && (
              <text x={w} y={l.y} textAnchor="end" className="fill-muted text-[13px]">
                {l.value}
              </text>
            )}
          </g>
        ))}
        {mix.months.map((m, i) =>
          i % every === 0 || i === lastI ? (
            <text
              key={m.month}
              x={x(i)}
              y={H - 6}
              textAnchor="middle"
              className="fill-muted text-[11px]"
            >
              {shortMonth(m.month)}
              {(i === 0 || m.month.endsWith("-01")) && ` '${m.month.slice(2, 4)}`}
            </text>
          ) : null,
        )}
        {mix.months.map((m, i) => (
          <rect
            key={m.month}
            x={(x(i) ?? 0) - step / 2}
            y={0}
            width={step}
            height={H - BOTTOM}
            fill="transparent"
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && hover !== null && (
        <ChartTip x={Math.min(Math.max(x(hover) ?? 0, 110), plotW - 110)} y={H - BOTTOM - 8}>
          <span className="block font-bold">
            {shortMonth(hovered.month)} · {money(hovered.total)}
          </span>
          {series.map((s) => (
            <span key={s.key} className="mt-0.5 flex items-center gap-2">
              <span
                aria-hidden="true"
                className="size-2.5 rounded-[2px]"
                style={{ background: s.color }}
              />
              <span className="flex-1 text-muted">{s.name}</span>
              <strong>{money(hovered.values[s.key] ?? 0)}</strong>
            </span>
          ))}
        </ChartTip>
      )}
    </div>
  );
}
