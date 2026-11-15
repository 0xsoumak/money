import { scaleLog } from "d3-scale";
import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { T } from "../T";
import { compactMoney, Label, Readout, seriesOf, shortDate, useScrub, useWidth } from "./frame";

const H = 200;
const AXIS = 22;
const R = 4;

export interface SwarmItem {
  amount: number;
  categoryId: string;
  date: string;
  note: string | null;
}

/** Every expense as a dot on a log scale, packed so none overlap. Touch a dot to read it. */
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
  const [onLayout, w] = useWidth();
  const mid = (H - AXIS) / 2;
  const lo = items.length ? Math.max(100, Math.min(...items.map((i) => i.amount))) : 100;
  const hi = items.length ? Math.max(lo * 10, ...items.map((i) => i.amount)) : 1000;
  const x = useMemo(
    () =>
      scaleLog()
        .domain([lo, hi])
        .range([R + 2, Math.max(w - R - 2, 20)])
        .nice(),
    [lo, hi, w],
  );

  const dots = useMemo(() => {
    if (w === 0) return [];
    const D = R * 2 + 1;
    const placed: { x: number; y: number; item: SwarmItem }[] = [];
    for (const item of [...items].sort((a, b) => a.amount - b.amount)) {
      const px = x(item.amount);
      let y = mid;
      for (let n = 0; n < 200; n++) {
        const cy = mid + Math.ceil(n / 2) * (n % 2 ? 1 : -1) * 2;
        if (
          placed.every((p) => Math.abs(p.x - px) >= D || (p.x - px) ** 2 + (p.y - cy) ** 2 >= D * D)
        ) {
          y = cy;
          break;
        }
      }
      placed.push({ x: px, y: Math.min(Math.max(y, R), H - AXIS - R), item });
    }
    return placed;
  }, [items, x, mid, w]);

  const { sel, handlers } = useScrub((px, py) => {
    let best: number | null = null;
    let bestD = 24 * 24;
    dots.forEach((d, i) => {
      const dd = (d.x - px) ** 2 + (d.y - py) ** 2;
      if (dd < bestD) {
        bestD = dd;
        best = i;
      }
    });
    return best;
  });

  if (items.length === 0) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        No spending in this range.
      </T>
    );
  }

  const ticks = x.ticks().filter((t) => /^10+$/.test(String(t)));
  const picked = sel === null ? null : dots[sel];

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={
          picked
            ? `${picked.item.note || seriesOf(picked.item.categoryId, byId).name} · ${shortDate(picked.item.date)}`
            : `Median of ${items.length} expenses`
        }
        value={money(picked ? picked.item.amount : median)}
      />
      <View
        onLayout={onLayout}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${items.length} expenses by size. Median ${money(median)}.`}
        {...handlers}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            {ticks.map((t) => (
              <Line
                key={t}
                x1={x(t)}
                x2={x(t)}
                y1={4}
                y2={H - AXIS}
                stroke={c.border}
                strokeWidth={1}
              />
            ))}
            {ticks.map((t) => (
              <Label key={`l${t}`} x={x(t)} y={H - 5} size={10} anchor="middle">
                {compactMoney(t)}
              </Label>
            ))}
            <Line
              x1={x(median)}
              x2={x(median)}
              y1={0}
              y2={H - AXIS + 3}
              stroke={c.accent}
              strokeWidth={2}
            />
            {dots.map((d, i) => (
              <Circle
                key={`${d.item.date}-${i}`}
                cx={d.x}
                cy={d.y}
                r={sel === i ? R + 2 : R}
                fill={seriesOf(d.item.categoryId, byId).color}
                stroke={sel === i ? c.text : c.bg}
                strokeWidth={1.5}
              />
            ))}
          </Svg>
        )}
      </View>
    </View>
  );
}
