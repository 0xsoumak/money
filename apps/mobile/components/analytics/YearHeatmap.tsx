import { type DayStats, heatLevel, heatLevels, weekday } from "@money/shared";
import { useRef, useState } from "react";
import { ScrollView, type ScrollViewInstance, View } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { select } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { c } from "../../lib/theme";
import { T } from "../T";
import { Label, mix, Readout, shortDate, shortMonth } from "./frame";

/** One hue, dim to bright: level 0 is "nothing spent", 4 the busiest days. */
const LEVELS = [
  c.surface,
  mix(c.bg, c.accent, 0.25),
  mix(c.bg, c.accent, 0.45),
  mix(c.bg, c.accent, 0.7),
  c.accent,
];
const STEP = 16;
const SIZE = 13;
const LEFT = 30;
const TOP = 18;

/**
 * Every day in the range as a tile, one column per week (Monday on top).
 * Scrolls sideways, opening at today. Tap a tile to read it.
 */
export function YearHeatmap({
  dates,
  daily,
  todayDate,
  peak,
}: {
  dates: string[];
  daily: Map<string, number>;
  todayDate: string;
  peak: DayStats["peak"];
}) {
  const money = useMoney();
  const [sel, setSel] = useState<number | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);
  const offset = dates.length ? weekday(dates[0] as string) : 0;
  const cols = Math.ceil((dates.length + offset) / 7);
  const cuts = heatLevels(dates.map((d) => daily.get(d) ?? 0));
  const cells = dates.map((date, i) => {
    const total = daily.get(date) ?? 0;
    return {
      date,
      total,
      x: LEFT + Math.floor((i + offset) / 7) * STEP,
      y: TOP + weekday(date) * STEP,
      fill: LEVELS[heatLevel(total, cuts)] as string,
    };
  });
  const months = cells.filter((x, i) => i === 0 || x.date.endsWith("-01"));
  const picked = sel === null ? null : cells[sel];

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={
          picked
            ? shortDate(picked.date)
            : peak
              ? `Biggest day · ${shortDate(peak.date)}`
              : "No spending yet"
        }
        value={
          picked
            ? picked.total > 0
              ? money(picked.total)
              : "No spend"
            : peak
              ? money(peak.total)
              : ""
        }
      />
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator={false}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        accessibilityLabel={`Daily spending for ${dates.length} days, brighter tiles mean more spent.`}
      >
        <Svg width={LEFT + cols * STEP} height={TOP + 7 * STEP}>
          {months.map((m) => (
            <Label key={m.date} x={m.x} y={11} size={10}>
              {shortMonth(m.date)}
            </Label>
          ))}
          {(
            [
              [0, "Mon"],
              [2, "Wed"],
              [4, "Fri"],
            ] as const
          ).map(([row, label]) => (
            <Label key={label} x={0} y={TOP + row * STEP + SIZE - 2} size={10} fill={c.textFaint}>
              {label}
            </Label>
          ))}
          {cells.map((x, i) => (
            <Rect
              key={x.date}
              x={x.x}
              y={x.y}
              width={SIZE}
              height={SIZE}
              rx={3}
              fill={x.fill}
              stroke={x.date === todayDate || sel === i ? c.text : undefined}
              strokeWidth={2}
              onPress={() => {
                select();
                setSel(sel === i ? null : i);
              }}
            />
          ))}
        </Svg>
      </ScrollView>
      <View
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 4 }}
      >
        <T variant="caption" color={c.textMuted}>
          Less
        </T>
        {LEVELS.map((fill) => (
          <View
            key={fill}
            style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: fill }}
          />
        ))}
        <T variant="caption" color={c.textMuted}>
          More
        </T>
      </View>
    </View>
  );
}
