import { Feather } from "@expo/vector-icons";
import { addMonths, currentMonth, monthTitle } from "@money/shared";
import { Pressable, View } from "react-native";
import { useMonth } from "../lib/month";
import { c } from "../lib/theme";
import { T } from "./T";
import { IconButton } from "./ui";

/** Previous / month name / next, plus a "Today" shortcut when browsing another month. */
export function MonthSwitcher() {
  const { month, setMonth } = useMonth();
  const isCurrent = month === currentMonth();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <IconButton label="Previous month" bordered onPress={() => setMonth(addMonths(month, -1))}>
        <Feather name="chevron-left" size={20} color={c.text} />
      </IconButton>
      <T variant="label" style={{ minWidth: 150, textAlign: "center" }} accessibilityRole="header">
        {monthTitle(month)}
      </T>
      <IconButton label="Next month" bordered onPress={() => setMonth(addMonths(month, 1))}>
        <Feather name="chevron-right" size={20} color={c.text} />
      </IconButton>
      {!isCurrent && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setMonth(currentMonth())}
          style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
        >
          <T variant="label" color={c.accent} size={13}>
            Today
          </T>
        </Pressable>
      )}
    </View>
  );
}
