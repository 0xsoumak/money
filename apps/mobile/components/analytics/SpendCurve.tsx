import type { SpendCurve as Curve } from "@money/shared";
import { scaleLinear } from "d3-scale";
import { line } from "d3-shape";
import { View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import { c } from "../../lib/theme";
import { T } from "../T";
import { compactMoney, Label, Readout, useScrub, useWidth } from "./frame";

const H = 210;
const TOP = 10;
const BOTTOM = 22;

/** One line of the legend under the chart: a short sample of the line style, then words. */
function Key({ color, dashed, text }: { color: string; dashed?: boolean; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Svg width={22} height={6}>
        <Line
          x1={1}
          x2={21}
          y1={3}
          y2={3}
          stroke={color}
          strokeWidth={dashed ? 2 : 3}
          strokeDasharray={dashed ? "4 3" : undefined}
          strokeLinecap="round"
        />
      </Svg>
      <T variant="caption" color={c.textMuted}>
        {text}
      </T>
    </View>
  );
}

/** Running total this month against last month, the usual month and the budget. Touch to read a day. */
export function SpendCurve({ curve, budget }: { curve: Curve; budget: number | null }) {
  const money = useMoney();
  const [onLayout, w] = useWidth();
  const span = Math.max(curve.days, curve.previous.length);
  const top = Math.max(
    curve.current.at(-1) ?? 0,
    curve.previous.at(-1) ?? 0,
    curve.average?.at(-1) ?? 0,
    budget ?? 0,
    1,
  );
  const x = scaleLinear()
    .domain([1, span])
    .range([4, Math.max(w - 4, 10)]);
  const y = scaleLinear()
    .domain([0, top])
    .range([H - BOTTOM, TOP])
    .nice(4);
  const path = line<number>()
    .x((_, i) => x(i + 1))
    .y((v) => y(v));
  const { sel, handlers } = useScrub((px) => Math.min(Math.max(Math.round(x.invert(px)), 1), span));

  const now = curve.current.at(-1) ?? 0;
  const at = (arr: number[] | null | undefined, d: number) =>
    arr && d <= arr.length ? arr[d - 1] : undefined;
  const readout =
    sel === null
      ? {
          label: curve.elapsed > 0 ? `Day ${curve.elapsed} · this month` : "Not started",
          value: money(now),
        }
      : {
          label: `Day ${sel} · last month ${money(at(curve.previous, sel) ?? curve.previous.at(-1) ?? 0)}`,
          value: at(curve.current, sel) !== undefined ? money(at(curve.current, sel) ?? 0) : "–",
        };

  return (
    <View style={{ gap: 10 }}>
      <Readout {...readout} />
      <View
        onLayout={onLayout}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Running total by day. This month ${money(now)} after ${curve.elapsed} days; last month ${money(curve.previous.at(-1) ?? 0)}.`}
        {...handlers}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            {y.ticks(4).map((t) => (
              <Line key={t} x1={0} x2={w} y1={y(t)} y2={y(t)} stroke={c.border} strokeWidth={1} />
            ))}
            {y.ticks(4).map((t) => (
              <Label key={`l${t}`} x={0} y={y(t) - 4} size={10} fill={c.textFaint}>
                {compactMoney(t)}
              </Label>
            ))}
            {budget !== null && (
              <Line
                x1={0}
                x2={w}
                y1={y(budget)}
                y2={y(budget)}
                stroke={c.textMuted}
                strokeWidth={1.5}
                strokeDasharray="2 4"
              />
            )}
            {curve.average && (
              <Path
                d={path(curve.average) ?? ""}
                fill="none"
                stroke={c.textFaint}
                strokeWidth={2}
                strokeDasharray="5 4"
              />
            )}
            {curve.previous.length > 0 && (
              <Path
                d={path(curve.previous) ?? ""}
                fill="none"
                stroke={c.textMuted}
                strokeWidth={2}
              />
            )}
            {curve.current.length > 1 && (
              <Path
                d={path(curve.current) ?? ""}
                fill="none"
                stroke={c.accent}
                strokeWidth={3}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {curve.elapsed > 0 && (
              <Circle
                cx={x(curve.elapsed)}
                cy={y(now)}
                r={5.5}
                fill={c.accent}
                stroke={c.bg}
                strokeWidth={2}
              />
            )}
            {sel !== null && (
              <Line
                x1={x(sel)}
                x2={x(sel)}
                y1={TOP}
                y2={H - BOTTOM}
                stroke={c.text}
                strokeOpacity={0.5}
                strokeWidth={1}
              />
            )}
            {[1, 8, 15, 22, 29]
              .filter((d) => d <= span)
              .map((d) => (
                <Label
                  key={`d${d}`}
                  x={Math.min(Math.max(x(d), 6), w - 6)}
                  y={H - 4}
                  size={10}
                  anchor="middle"
                  fill={c.textFaint}
                >
                  {String(d)}
                </Label>
              ))}
          </Svg>
        )}
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 16, rowGap: 6 }}>
        <Key color={c.accent} text={`This month ${compactMoney(now)}`} />
        {curve.previous.length > 0 && (
          <Key
            color={c.textMuted}
            text={`Last month ${compactMoney(curve.previous.at(-1) ?? 0)}`}
          />
        )}
        {curve.average && (
          <Key
            color={c.textFaint}
            dashed
            text={`Usual ${compactMoney(curve.average.at(-1) ?? 0)}`}
          />
        )}
        {budget !== null && (
          <Key color={c.textMuted} dashed text={`Budget ${compactMoney(budget)}`} />
        )}
      </View>
    </View>
  );
}
