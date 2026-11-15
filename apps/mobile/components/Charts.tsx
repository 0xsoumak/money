import { monthTitle, type StatItem } from "@money/shared";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { select } from "../lib/haptics";
import { useMoney } from "../lib/hooks";
import { c } from "../lib/theme";
import { PressableScale, timing } from "./motion";
import { Label, T } from "./T";

const CHART_H = 132;

const shortMonth = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleString("en", { month: "short" });

/** A bar that eases from the baseline to `height`, after `delay` ms. */
function Bar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withTiming(height, timing.slow));
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[
        { width: "100%", backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
        style,
      ]}
    />
  );
}

/** Six months, one bar each, amount on top. The viewed month is lime; tap a bar to open it. */
export function MonthTrend({
  months,
  current,
  onPick,
  verb = "spent",
}: {
  months: { month: string; value: number }[];
  current: string;
  onPick: (month: string) => void;
  /** Read out by screen readers: "May 2026: spent ₹40,000". */
  verb?: string;
}) {
  const money = useMoney();
  const max = Math.max(...months.map((m) => m.value), 1);
  const H = CHART_H - 24;
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
      {months.map((m, i) => {
        const selected = m.month === current;
        return (
          <PressableScale
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(m.month)}: ${verb} ${money(m.value)}`}
            accessibilityState={{ selected }}
            onPress={() => {
              select();
              onPick(m.month);
            }}
            style={{ flex: 1, alignItems: "stretch", gap: 6 }}
          >
            <T
              variant="caption"
              size={10.5}
              color={selected ? c.text : c.textMuted}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ textAlign: "center", fontWeight: "700" }}
            >
              {m.value > 0 ? money(m.value) : "–"}
            </T>
            <View style={{ height: H, justifyContent: "flex-end" }}>
              <Bar
                height={m.value > 0 ? Math.max((m.value / max) * H, 4) : 2}
                delay={i * 50}
                color={selected ? c.accent : c.surfaceStrong}
              />
            </View>
            <T
              variant="caption"
              color={selected ? c.text : c.textMuted}
              style={{ textAlign: "center", fontWeight: selected ? "700" : "400" }}
            >
              {shortMonth(m.month)}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The four overview stats in a 2×2 grid. */
export function StatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 2,
        borderColor: c.border,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{
            width: "50%",
            padding: 14,
            gap: 2,
            borderColor: c.border,
            borderRightWidth: i % 2 === 0 ? 1 : 0,
            borderBottomWidth: i < 2 ? 1 : 0,
          }}
        >
          <T variant="label" size={11} color={c.textMuted}>
            {s.label}
          </T>
          <T
            variant="title"
            size={20}
            fit
            color={s.tone === "danger" ? c.danger : s.tone === "accent" ? c.accent : undefined}
            style={{ marginTop: 2 }}
          >
            {s.value}
          </T>
          <T variant="caption" color={c.textMuted} numberOfLines={2}>
            {s.hint}
          </T>
        </View>
      ))}
    </View>
  );
}
