import { scaleLog } from "d3-scale";
import { useMemo, useState } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { ChartTip, compactMoney, seriesOf, shortDate, useWidth } from "./frame";

const H = 230;
const AXIS = 24;
const R = 4.5;

export interface SwarmItem {
  amount: number;
  categoryId: string;
  date: string;
  note: string | null;
}

/**
 * Every expense as a dot on a log scale of amount, packed so none overlap
 * (a beeswarm). Shows at a glance whether money goes in many small buys or a few big ones.
 */
export function SizeSwarm({
  items,
  median,
  byId,
}: {
  items: SwarmItem[];
  median: number;
  byId: Map<string, Category>;
}) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);
  const mid = (H - AXIS) / 2;

  const lo = Math.max(100, Math.min(...items.map((i) => i.amount)));
  const hi = Math.max(lo * 10, ...items.map((i) => i.amount));
  const x = useMemo(
    () =>
      scaleLog()
        .domain([lo, hi])
        .range([R + 2, w - R - 2])
        .nice(),
    [lo, hi, w],
  );

  const dots = useMemo(() => {
    const D = R * 2 + 1;
    const placed: { x: number; y: number; item: SwarmItem }[] = [];
    const sorted = [...items].sort((a, b) => a.amount - b.amount);
    for (const item of sorted) {
      const px = x(item.amount);
      // Try the midline, then step outward alternately above and below until it fits.
      let y = mid;
      for (let n = 0; n < 200; n++) {
        const off = Math.ceil(n / 2) * (n % 2 ? 1 : -1) * 2;
        const cy = mid + off;
        const near = placed.filter((p) => Math.abs(p.x - px) < D);
        if (near.every((p) => (p.x - px) ** 2 + (p.y - cy) ** 2 >= D * D)) {
          y = cy;
          break;
        }
      }
      placed.push({ x: px, y: Math.min(Math.max(y, R), H - AXIS - R), item });
    }
    return placed;
  }, [items, x, mid]);

  if (items.length === 0) {
    return <p className="border-b border-line py-8 text-muted">No spending in this range.</p>;
  }

  // Powers of ten only (₹1, ₹10, ₹100 …); amounts are paise, so 100 = ₹1.
  const ticks = x.ticks().filter((t) => /^10+$/.test(String(t)));
  const hovered = hover === null ? null : dots[hover];

  return (
    <div ref={ref} className="relative w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`${items.length} expenses by size, from ${money(lo)} to ${money(hi)}. Median ${money(median)}.`}
        className="block"
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={6} y2={H - AXIS} className="stroke-line" />
            <text x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted text-[11px]">
              {compactMoney(t)}
            </text>
          </g>
        ))}
        <line
          x1={x(median)}
          x2={x(median)}
          y1={2}
          y2={H - AXIS + 4}
          className="stroke-accent"
          strokeWidth={2}
        />
        <text
          x={x(median) + (x(median) > w * 0.7 ? -8 : 8)}
          y={14}
          textAnchor={x(median) > w * 0.7 ? "end" : "start"}
          className="fill-ink text-xs font-bold"
        >
          median {money(median)}
        </text>
        {dots.map((d, i) => (
          <circle
            key={`${d.item.date}-${i}`}
            cx={d.x}
            cy={d.y}
            r={hover === i ? R + 2 : R}
            className="stroke-bg"
            strokeWidth={1.5}
            style={{ fill: seriesOf(d.item.categoryId, byId).color }}
            onPointerEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hovered && (
        <ChartTip x={hovered.x} y={hovered.y}>
          <strong>{money(hovered.item.amount)}</strong>{" "}
          <span className="text-muted">
            {hovered.item.note || seriesOf(hovered.item.categoryId, byId).name} ·{" "}
            {shortDate(hovered.item.date)}
          </span>
        </ChartTip>
      )}
    </div>
  );
}
