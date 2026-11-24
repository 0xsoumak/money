// Mobile twin of RateGauge in apps/web/src/components/charts/Explore.tsx. Keep the two in step.
import { arc } from "d3-shape";
import { View } from "react-native";
import Svg, { G, Line, Path } from "react-native-svg";
import { c } from "../../lib/theme";
import { T } from "../T";

const SIZE = 150;
const STROKE = 14;
const SWEEP = (240 * Math.PI) / 180;
const START = -SWEEP / 2;

/** This month's share of income invested as a bold arc, with a tick at your usual share. */
export function RateGauge({ rate, usual }: { rate: number; usual: number | null }) {
  const top = Math.max(0.5, Math.ceil(Math.max(rate, usual ?? 0) * 10) / 10 + 0.1);
  const r = SIZE / 2 - 4;
  const ring = arc<{ end: number }>()
    .innerRadius(r - STROKE)
    .outerRadius(r)
    .cornerRadius(STROKE / 2)
    .startAngle(START)
    .endAngle((d) => d.end);
  const angle = (v: number) => START + SWEEP * Math.min(1, v / top);
  // The usual tick, across the ring at its angle (0 rad points up, clockwise).
  const ua = usual !== null && usual > 0 ? angle(usual) : null;
  const tick =
    ua !== null
      ? {
          x1: Math.sin(ua) * (r - STROKE - 5),
          y1: -Math.cos(ua) * (r - STROKE - 5),
          x2: Math.sin(ua) * (r + 3),
          y2: -Math.cos(ua) * (r + 3),
        }
      : null;

  return (
    <View
      accessible
      accessibilityLabel={`${Math.round(rate * 100)}% of income invested${usual !== null ? `, usually ${Math.round(usual * 100)}%` : ""}.`}
      style={{ width: SIZE, height: SIZE * 0.86, alignItems: "center" }}
    >
      <Svg width={SIZE} height={SIZE}>
        <G x={SIZE / 2} y={SIZE / 2}>
          <Path d={ring({ end: START + SWEEP }) ?? ""} fill={c.surfaceStrong} />
          {rate > 0 && <Path d={ring({ end: angle(rate) }) ?? ""} fill={c.accent} />}
          {tick && <Line {...tick} stroke={c.text} strokeWidth={3} strokeLinecap="round" />}
        </G>
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T variant="title" size={30}>
          {Math.round(rate * 100)}%
        </T>
        <T variant="caption" color={c.textMuted}>
          of income
        </T>
      </View>
    </View>
  );
}
