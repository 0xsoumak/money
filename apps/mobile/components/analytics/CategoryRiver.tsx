import type { CategoryMix } from "@money/shared";
import { scaleLinear, scalePoint } from "d3-scale";
import { area, curveMonotoneX, stack, stackOffsetSilhouette, stackOrderNone } from "d3-shape";
import { View } from "react-native";
import Svg, { G, Line, Path } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { T } from "../T";
import {
  compactMoney,
  Label,
  Readout,
  seriesOf,
  shortMonth,
  spreadLabels,
  useScrub,
  useWidth,
} from "./frame";

const H = 240;
const BOTTOM = 22;
const LABELS = 84;

type Datum = Record<string, number>;

/** Streamgraph of monthly spending by category. Touch a month for its numbers. */
export function CategoryRiver({ mix, byId }: { mix: CategoryMix; byId: Map<string, Category> }) {
  const money = useMoney();
  const [onLayout, w] = useWidth();
  const n = mix.months.length;
  const plotW = Math.max(w - LABELS - 8, 40);
  const x = scalePoint<number>()
    .domain(mix.months.map((_, i) => i))
    .range([2, plotW]);
  const { sel, handlers } = useScrub((px) =>
    px > plotW + 4 || n === 0
      ? null
      : Math.min(n - 1, Math.max(0, Math.round(((px - 2) / Math.max(plotW - 2, 1)) * (n - 1)))),
  );

  if (mix.keys.length === 0 || mix.months.every((m) => m.total === 0)) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        No spending in this range.
      </T>
    );
  }

  const series = mix.keys.map((k) => seriesOf(k, byId));
  const layers = stack<Datum>().keys(mix.keys).offset(stackOffsetSilhouette).order(stackOrderNone)(
    mix.months.map((m) => ({ ...m.values })),
  );
  const maxTotal = Math.max(...mix.months.map((m) => m.total), 1);
  const y = scaleLinear()
    .domain([-maxTotal / 2, maxTotal / 2])
    .range([H - BOTTOM - 4, 4]);
  const shape = area<[number, number]>()
    .x((_, i) => x(i) ?? 0)
    .y0((d) => y(d[0]))
    .y1((d) => y(d[1]))
    .curve(curveMonotoneX);
  const last = n - 1;
  const labels = spreadLabels(
    layers.map((layer, i) => {
      const d = layer[last] as unknown as [number, number];
      const mid = (y(d[0]) + y(d[1])) / 2;
      return {
        key: series[i]?.key ?? String(i),
        name: series[i]?.name ?? "",
        anchor: mid,
        y: mid + 4,
      };
    }),
    16,
    10,
    H - BOTTOM,
  );
  const picked = sel === null ? null : mix.months[sel];
  const every = n > 6 ? 3 : 1;

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={
          picked
            ? shortMonth(picked.month)
            : `${shortMonth(mix.months[last]?.month ?? "")} · last full month`
        }
        value={money((picked ?? mix.months[last])?.total ?? 0)}
      />
      <View
        onLayout={onLayout}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Monthly spending by category over ${n} months.`}
        {...handlers}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            {layers.map((layer, i) => (
              <Path
                key={layer.key}
                d={shape(layer as unknown as [number, number][]) ?? ""}
                fill={series[i]?.color}
                stroke={c.bg}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            ))}
            {sel !== null && (
              <Line
                x1={x(sel)}
                x2={x(sel)}
                y1={0}
                y2={H - BOTTOM}
                stroke={c.text}
                strokeWidth={1.5}
              />
            )}
            {labels.map((l) => (
              <G key={l.key}>
                <Line
                  x1={plotW + 2}
                  x2={plotW + 8}
                  y1={l.anchor}
                  y2={l.y - 4}
                  stroke={c.textFaint}
                  strokeWidth={1}
                />
                <Label x={plotW + 11} y={l.y} size={11} weight={600} fill={c.text}>
                  {l.name.length > 10 ? `${l.name.slice(0, 9)}…` : l.name}
                </Label>
              </G>
            ))}
            {mix.months.map((m, i) =>
              (last - i) % every === 0 ? (
                <Label key={m.month} x={x(i) ?? 0} y={H - 5} size={10} anchor="middle">
                  {shortMonth(m.month)}
                </Label>
              ) : null,
            )}
          </Svg>
        )}
      </View>
      {picked && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6 }}>
          {series.map((s) => (
            <View key={s.key} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
              <T variant="caption" color={c.textMuted}>
                {s.name}
              </T>
              <T variant="caption">{compactMoney(picked.values[s.key] ?? 0)}</T>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
