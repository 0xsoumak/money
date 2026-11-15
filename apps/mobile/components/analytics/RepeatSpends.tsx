import type { RepeatSpend } from "@money/shared";
import { View } from "react-native";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { T } from "../T";
import { seriesOf } from "./frame";

/** Notes that keep coming back: how often and how much. Monthly ones are tagged. */
export function RepeatSpends({
  items,
  byId,
}: {
  items: RepeatSpend[];
  byId: Map<string, Category>;
}) {
  const money = useMoney();
  if (items.length === 0) {
    return (
      <T variant="body" color={c.textMuted} style={{ paddingVertical: 24 }}>
        Nothing repeats yet. Add a note to expenses (like “Swiggy”) to see them here.
      </T>
    );
  }
  const max = Math.max(...items.map((r) => r.total));
  return (
    <View>
      {items.map((r) => (
        <View
          key={r.note}
          style={{
            flexDirection: "row",
            gap: 12,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: c.border,
          }}
        >
          <View
            style={{
              width: 10,
              borderRadius: 3,
              backgroundColor: seriesOf(r.categoryId, byId).color,
            }}
          />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <T variant="body" size={16} numberOfLines={1} style={{ flexShrink: 1 }}>
                {r.note}
              </T>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: r.monthly ? c.accent : c.border,
                  borderRadius: 6,
                  paddingHorizontal: 6,
                  paddingVertical: 1,
                }}
              >
                <T variant="label" size={11} color={r.monthly ? c.accent : c.textMuted}>
                  {r.monthly ? "Monthly" : `×${r.count}`}
                </T>
              </View>
              <T variant="title" size={16} style={{ marginLeft: "auto" }}>
                {r.monthly ? `${money(r.latest)}/mo` : money(r.total)}
              </T>
            </View>
            <View
              style={{ height: 6, borderRadius: 3, backgroundColor: c.surface, overflow: "hidden" }}
            >
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  width: `${(r.total / max) * 100}%`,
                  backgroundColor: c.textMuted,
                }}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
