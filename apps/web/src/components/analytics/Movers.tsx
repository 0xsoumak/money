import type { Mover } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { compactMoney, seriesOf, spreadLabels, useWidth } from "./frame";

const H = 270;
const TOP = 34;
const BOTTOM = 14;
const MAX_ROWS = 6;

/**
 * Slope chart: each category's spending last month (left) and this month (right),
 * compared over the same days. Labelled at both ends with the change in words.
 */
export function Movers({
  movers,
  byId,
  labels,
}: {
  movers: Mover[];
  byId: Map<string, Category>;
  labels: [string, string];
}) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const rows = movers.slice(0, MAX_ROWS);

  if (rows.length === 0) {
    return <p className="border-b border-line py-8 text-muted">No spending to compare yet.</p>;
  }

  const xL = 76;
  const xR = Math.max(xL + 120, w - 210);
  const max = Math.max(...rows.flatMap((r) => [r.previous, r.current]), 1);
  const y = scaleLinear()
    .domain([0, max])
    .range([H - BOTTOM, TOP]);

  const items = rows.map((r) => {
    const s = seriesOf(r.categoryId, byId);
    return { ...r, ...s, y0: y(r.previous), y1: y(r.current) };
  });
  const leftLabels = spreadLabels(
    items.map((it) => ({ key: it.key, y: it.y0 + 4, text: compactMoney(it.previous) })),
    16,
    TOP,
    H,
  );
  const rightLabels = spreadLabels(
    items.map((it) => ({
      key: it.key,
      y: it.y1 + 4,
      name: it.name,
      change: `${it.change >= 0 ? "+" : "−"}${money(Math.abs(it.change))}`,
    })),
    17,
    TOP,
    H,
  );

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`Change by category, ${labels[0]} vs ${labels[1]}: ${items
          .map((it) => `${it.name} ${money(it.previous)} to ${money(it.current)}`)
          .join(", ")}.`}
        className="block"
      >
        {[
          [xL, labels[0]],
          [xR, labels[1]],
        ].map(([x, label]) => (
          <g key={label}>
            <text
              x={x}
              y={14}
              textAnchor="middle"
              className="fill-muted text-xs font-bold uppercase tracking-[0.08em]"
            >
              {label}
            </text>
            <line x1={x} x2={x} y1={TOP - 10} y2={H - BOTTOM + 4} className="stroke-line" />
          </g>
        ))}
        {/* Smallest changes first so the big movers draw on top. */}
        {[...items].reverse().map((it) => (
          <g key={it.key}>
            <line
              x1={xL}
              x2={xR}
              y1={it.y0}
              y2={it.y1}
              strokeWidth={3}
              strokeLinecap="round"
              style={{ stroke: it.color }}
            />
            <circle
              cx={xL}
              cy={it.y0}
              r={5}
              className="stroke-bg"
              strokeWidth={2}
              style={{ fill: it.color }}
            />
            <circle
              cx={xR}
              cy={it.y1}
              r={5}
              className="stroke-bg"
              strokeWidth={2}
              style={{ fill: it.color }}
            />
          </g>
        ))}
        {leftLabels.map((l) => (
          <text key={l.key} x={xL - 14} y={l.y} textAnchor="end" className="fill-muted text-xs">
            {l.text}
          </text>
        ))}
        {rightLabels.map((l) => (
          <g key={l.key}>
            <text x={xR + 14} y={l.y} className="fill-ink text-[13px] font-semibold">
              {l.name}
            </text>
            <text x={w} y={l.y} textAnchor="end" className="fill-ink text-[13px] font-bold">
              {l.change}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
