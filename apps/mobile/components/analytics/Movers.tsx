import type { Mover } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { View } from "react-native";
import Svg, { Circle, G, Line } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { T } from "../T";
import { compactMoney, Label, seriesOf, spreadLabels, useWidth } from "./frame";

const H = 240;
const TOP = 30;
const BOTTOM = 12;

/** Slope chart: last month (left) vs this month (right) per category, change in words. */
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
  const [onLayout, w] = useWidth();
  const rows = movers.slice(0, 6);

  if (rows.length === 0) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        No spending to compare yet.
      </T>
    );
  }

  const xL = 52;
  const xR = Math.max(xL + 90, w - 156);
  const max = Math.max(...rows.flatMap((r) => [r.previous, r.current]), 1);
  const y = scaleLinear()
    .domain([0, max])
    .range([H - BOTTOM, TOP]);
  const items = rows.map((r) => ({
    ...r,
    ...seriesOf(r.categoryId, byId),
    y0: y(r.previous),
    y1: y(r.current),
  }));
  const left = spreadLabels(
    items.map((it) => ({ key: it.key, y: it.y0 + 4, text: compactMoney(it.previous) })),
    15,
    TOP,
    H,
  );
  const right = spreadLabels(
    items.map((it) => ({
      key: it.key,
      y: it.y1 + 4,
      name: it.name.length > 10 ? `${it.name.slice(0, 9)}…` : it.name,
      change: `${it.change >= 0 ? "+" : "−"}${compactMoney(Math.abs(it.change))}`,
    })),
    16,
    TOP,
    H,
  );

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Change by category, ${labels[0]} vs ${labels[1]}: ${items
        .map((it) => `${it.name} ${money(it.previous)} to ${money(it.current)}`)
        .join(", ")}.`}
    >
      {w > 0 && (
        <Svg width={w} height={H}>
          {(
            [
              [xL, labels[0]],
              [xR, labels[1]],
            ] as const
          ).map(([x, label]) => (
            <G key={label}>
              <Label x={x} y={12} size={11} weight={700} anchor="middle">
                {label.toUpperCase()}
              </Label>
              <Line
                x1={x}
                x2={x}
                y1={TOP - 8}
                y2={H - BOTTOM + 4}
                stroke={c.border}
                strokeWidth={1}
              />
            </G>
          ))}
          {[...items].reverse().map((it) => (
            <G key={it.key}>
              <Line
                x1={xL}
                x2={xR}
                y1={it.y0}
                y2={it.y1}
                stroke={it.color}
                strokeWidth={3}
                strokeLinecap="round"
              />
              <Circle cx={xL} cy={it.y0} r={4.5} fill={it.color} stroke={c.bg} strokeWidth={2} />
              <Circle cx={xR} cy={it.y1} r={4.5} fill={it.color} stroke={c.bg} strokeWidth={2} />
            </G>
          ))}
          {left.map((l) => (
            <Label key={l.key} x={xL - 10} y={l.y} size={11} anchor="end">
              {l.text}
            </Label>
          ))}
          {right.map((l) => (
            <G key={l.key}>
              <Label x={xR + 10} y={l.y} size={12} weight={600} fill={c.text}>
                {l.name}
              </Label>
              <Label x={w} y={l.y} size={12} weight={700} fill={c.text} anchor="end">
                {l.change}
              </Label>
            </G>
          ))}
        </Svg>
      )}
    </View>
  );
}
