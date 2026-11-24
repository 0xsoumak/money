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
