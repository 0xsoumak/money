// Mobile twin of CalendarHeat in apps/web/src/components/charts/Rhythm.tsx. Keep the two in step.
import { daysInMonth, heatLevel, heatLevels, shortDate, weekday } from "@money/shared";
import { useState } from "react";
import { View } from "react-native";
import { select } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { c, fade } from "../../lib/theme";
import { T } from "../T";
import { Readout, useWidth } from "./frame";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const GAP = 5;
/** One hue, faint to full: more spent, more lime. Level 0 is a day with nothing spent. */
const LEVEL = [c.surface, fade(c.accent, 0.2), fade(c.accent, 0.4), fade(c.accent, 0.7), c.accent];

/** The month as a calendar, each day shaded by what was spent. Tap a day to read it. */
export function CalendarHeat({
  month,
  daily,
  todayDate,
}: {
  month: string;
  daily: Map<string, number>;
  todayDate: string;
}) {
  const money = useMoney();
  const [onLayout, w] = useWidth();
  const [sel, setSel] = useState<string | null>(null);

  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const dates = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const lead = weekday(dates[0] as string);
  const cuts = heatLevels(dates.map((d) => daily.get(d) ?? 0));
  const cell = w > 0 ? (w - GAP * 6) / 7 : 0;
  const cells: (string | null)[] = [...Array.from({ length: lead }, () => null), ...dates];

  return (
    <View style={{ gap: 10 }}>
      <Readout
        label={sel ? shortDate(sel) : "Tap a day"}
        value={sel ? money(daily.get(sel) ?? 0) : ""}
      />
      <View onLayout={onLayout} style={{ gap: GAP }}>
        <View style={{ flexDirection: "row", gap: GAP }}>
          {WEEKDAYS.map((d, i) => (
            <T
              key={i}
              variant="caption"
              size={11}
              color={c.textFaint}
              style={{ width: cell, textAlign: "center" }}
            >
              {d}
            </T>
          ))}
        </View>
        {cell > 0 && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
            {cells.map((date, i) => {
              if (!date) return <View key={`pad${i}`} style={{ width: cell, height: cell }} />;
              const v = daily.get(date) ?? 0;
              const future = date > todayDate;
              const level = future ? 0 : heatLevel(v, cuts);
              const isToday = date === todayDate;
              return (
                <View
                  key={date}
                  accessible
                  accessibilityLabel={
                    future ? `${shortDate(date)}: still to come` : `${shortDate(date)}: ${money(v)}`
                  }
                  onStartShouldSetResponder={() => !future}
                  onResponderGrant={() => {
                    select();
                    setSel(date);
                  }}
                  style={{
                    width: cell,
                    height: cell,
                    borderRadius: 7,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: future ? "transparent" : LEVEL[level],
                    borderWidth: future || isToday || sel === date ? 1.5 : 0,
                    borderStyle: future ? "dashed" : "solid",
                    borderColor: future ? c.border : c.text,
                  }}
                >
                  <T
                    variant="caption"
                    size={11}
                    color={
                      future
                        ? c.textFaint
                        : level >= 3
                          ? c.onAccent
                          : level > 0
                            ? c.text
                            : c.textMuted
                    }
                    style={{ fontWeight: "600" }}
                  >
                    {i - lead + 1}
                  </T>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
