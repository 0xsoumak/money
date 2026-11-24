import { Feather } from "@expo/vector-icons";
import { addMonths, currentMonth, monthTitle } from "@money/shared";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useMonth } from "../lib/month";
import { c } from "../lib/theme";
import { duration, ease } from "./motion";
import { T } from "./T";
import { IconButton } from "./ui";

/** Previous / month name / next, plus a "Today" shortcut when browsing another month. */
export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  const isCurrent = month === currentMonth();
  // Slide the new title in from the side we moved towards.
  const prev = useRef(month);
  const forward = month >= prev.current;
  useEffect(() => {
    prev.current = month;
  }, [month]);
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, minWidth: 0 }}
    >
      <IconButton label="Previous month" bordered onPress={() => setMonth(addMonths(month, -1))}>
        <Feather name="chevron-left" size={20} color={c.text} />
      </IconButton>
      {/* Prefers 150 wide but gives way on narrow phones, so the row never runs under its neighbours. */}
      <View style={{ flexBasis: 150, flexShrink: 1, minWidth: 0, overflow: "hidden" }}>
        <Animated.View
          key={month}
          entering={(forward ? FadeInRight : FadeInLeft).duration(duration.base).easing(ease)}
        >
          <T variant="label" style={{ textAlign: "center" }} accessibilityRole="header" fit>
            {monthTitle(month)}
          </T>
        </Animated.View>
      </View>
      <IconButton label="Next month" bordered onPress={() => setMonth(addMonths(month, 1))}>
        <Feather name="chevron-right" size={20} color={c.text} />
      </IconButton>
      {!isCurrent && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setMonth(currentMonth())}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 6, flexShrink: 0 }}
        >
          <T variant="label" color={c.accent} size={13}>
            Today
          </T>
        </Pressable>
      )}
    </View>
  );
}
