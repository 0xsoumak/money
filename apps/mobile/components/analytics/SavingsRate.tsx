import type { SavingsMonth } from "@money/shared";
import { scaleLinear, scalePoint } from "d3-scale";
import { line } from "d3-shape";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import { c } from "../../lib/theme";
import { T } from "../T";
import { Label, Readout, shortMonth, useScrub, useWidth } from "./frame";

const H = 190;
const TOP = 12;
const BOTTOM = 22;
const RIGHT = 54;
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Share of income invested each month; latest month in lime, dashed average. Touch to read a month. */
export function SavingsRate({ months }: { months: SavingsMonth[] }) {
  const money = useMoney();
  const [onLayout, w] = useWidth();
  const plotW = Math.max(w - RIGHT, 40);
  const x = scalePoint<number>()
    .domain(months.map((_, i) => i))
    .range([8, plotW - 8]);
  const points = months
    .map((m, i) => ({ ...m, i }))
    .filter((m): m is SavingsMonth & { i: number; rate: number } => m.rate !== null);
  const { sel, handlers } = useScrub((px) => {
    let best: number | null = null;
    for (const p of points)
      if (best === null || Math.abs((x(p.i) ?? 0) - px) < Math.abs((x(best) ?? 0) - px)) best = p.i;
    return best;
  });

  if (points.length === 0) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        No income logged in this range.
      </T>
    );
  }

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
  const picked = points.find((p) => p.i === sel) ?? last;
  const every = months.length > 6 ? 2 : 1;

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={`${shortMonth(picked.month)} · ${money(picked.invested)} of ${money(picked.income)}`}
        value={pct(picked.rate)}
      />
      <View
        onLayout={onLayout}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Share of income invested: ${points.map((p) => `${shortMonth(p.month)} ${pct(p.rate)}`).join(", ")}.`}
        {...handlers}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            {y.ticks(4).map((t) => (
              <Line
                key={t}
                x1={0}
                x2={plotW}
                y1={y(t)}
                y2={y(t)}
                stroke={c.border}
                strokeWidth={1}
              />
            ))}
            {y.ticks(4).map((t) => (
              <Label key={`l${t}`} x={0} y={y(t) - 4} size={10} fill={c.textFaint}>
                {pct(t)}
              </Label>
            ))}
            <Line
              x1={0}
              x2={plotW}
              y1={y(avg)}
              y2={y(avg)}
              stroke={c.textFaint}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
            <Label x={plotW + 6} y={y(avg) + 4} size={11}>
              {`avg ${pct(avg)}`}
            </Label>
            <Path
              d={path(points) ?? ""}
              fill="none"
              stroke={c.text}
              strokeWidth={2}
              strokeLinejoin="round"
            />
            {points.map((p) => (
              <Circle
                key={p.month}
                cx={x(p.i)}
                cy={y(p.rate)}
                r={p === last ? 6.5 : p.i === sel ? 6 : 4}
                fill={p === last ? c.accent : c.text}
                stroke={c.bg}
                strokeWidth={2}
              />
            ))}
            {months.map((m, i) =>
              (months.length - 1 - i) % every === 0 ? (
                <Label key={m.month} x={x(i) ?? 0} y={H - 5} size={10} anchor="middle">
                  {shortMonth(m.month)}
                </Label>
              ) : null,
            )}
          </Svg>
        )}
      </View>
    </View>
  );
}
