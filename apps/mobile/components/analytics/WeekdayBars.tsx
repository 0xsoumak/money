import { View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useMoney } from "../../lib/hooks";
import { c } from "../../lib/theme";
import { compactMoney, Label, Readout, useScrub, useWidth } from "./frame";

const H = 190;
const TOP = 22;
const BASE = 164;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function bar(x: number, y: number, w: number, r = 4) {
  const rr = Math.min(r, BASE - y);
  return `M${x},${BASE} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${BASE} Z`;
}

/** Average spending per weekday; the busiest day is solid. Touch a bar for the exact figure. */
export function WeekdayBars({ averages }: { averages: number[] }) {
  const money = useMoney();
  const [onLayout, w] = useWidth();
  const step = w / 7;
  const bw = Math.min(40, step * 0.62);
  const max = Math.max(...averages, 1);
  const peak = averages.indexOf(Math.max(...averages));
  const { sel, handlers } = useScrub((px) =>
    step > 0 ? Math.min(6, Math.max(0, Math.floor(px / step))) : null,
  );
  const shown = sel ?? peak;

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={sel === null ? `Busiest · ${FULL[peak]}` : (FULL[sel] ?? "")}
        value={money(averages[shown] ?? 0)}
      />
      <View
        onLayout={onLayout}
        style={{ height: H }}
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Average spend by weekday: ${averages.map((v, i) => `${DAYS[i]} ${money(v)}`).join(", ")}.`}
        {...handlers}
      >
        {w > 0 && (
          <Svg width={w} height={H}>
            {averages.map((v, i) => {
              const x = i * step + (step - bw) / 2;
              const y = BASE - Math.max((v / max) * (BASE - TOP), v > 0 ? 3 : 1);
              const strong = i === shown;
              return (
                <Path key={DAYS[i]} d={bar(x, y, bw)} fill={strong ? c.text : c.surfaceStrong} />
              );
            })}
            {averages.map((v, i) => {
              const x = i * step + step / 2;
              const y = BASE - Math.max((v / max) * (BASE - TOP), v > 0 ? 3 : 1);
              const strong = i === shown;
              return (
                <Label
                  key={`v${DAYS[i]}`}
                  x={x}
                  y={y - 6}
                  size={10}
                  weight={700}
                  anchor="middle"
                  fill={strong ? c.text : c.textMuted}
                >
                  {compactMoney(v)}
                </Label>
              );
            })}
            {DAYS.map((d, i) => (
              <Label
                key={d}
                x={i * step + step / 2}
                y={H - 6}
                size={11}
                weight={700}
                anchor="middle"
                fill={i === shown ? c.text : c.textMuted}
              >
                {d.toUpperCase()}
              </Label>
            ))}
            <Line x1={0} x2={w} y1={BASE} y2={BASE} stroke={c.borderStrong} strokeWidth={1} />
          </Svg>
        )}
      </View>
    </View>
  );
}
