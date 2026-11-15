import { groupByDay } from "@money/shared";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from "react-native-reanimated";
import { useMoney } from "../lib/hooks";
import type { Category, Tx } from "../lib/queries";
import { c, cat } from "../lib/theme";
import { duration, ease } from "./motion";
import { SwipeRow } from "./SwipeRow";
import { T } from "./T";
import { SectionHeader } from "./ui";

/**
 * Transactions grouped by day, newest first.
 * Tap a row (or swipe it right) to edit it; swipe it left to delete it.
 */
export function TransactionList({
  transactions,
  categories,
  onEdit,
  onDelete,
}: {
  transactions: Tx[];
  categories: Category[];
  onEdit: (tx: Tx) => void;
  onDelete: (tx: Tx) => void;
}) {
  const money = useMoney();
  const byId = new Map(categories.map((x) => [x.id, x]));
  const groups = groupByDay(transactions);

  return (
    // Rows already on screen appear without animating; only rows added later fade in.
    <LayoutAnimationConfig skipEntering>
      <View style={{ gap: 28 }}>
        {groups.map((g) => (
          <View key={g.date}>
            <SectionHeader
              title={g.label}
              right={
                g.spent > 0 ? (
                  <T variant="small" size={14} color={c.textMuted}>
                    {money(g.spent)}
                  </T>
                ) : undefined
              }
            />
            {g.items.map((tx) => {
              const category = byId.get(tx.categoryId);
              const title = tx.note || category?.name || "Transaction";
              return (
                <Animated.View
                  key={tx.id}
                  entering={FadeIn.duration(duration.base).easing(ease)}
                  exiting={FadeOut.duration(duration.fast)}
                  layout={LinearTransition.duration(duration.base).easing(ease)}
                  style={{ borderBottomWidth: 1, borderBottomColor: c.border }}
                >
                  <SwipeRow onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${title}, ${money(tx.amount)}`}
                      accessibilityHint="Swipe left to delete"
                      accessibilityActions={[{ name: "delete", label: "Delete" }]}
                      onAccessibilityAction={(e) => {
                        if (e.nativeEvent.actionName === "delete") onDelete(tx);
                      }}
                      onPress={() => onEdit(tx)}
                      style={({ pressed }) => ({
                        minHeight: 68,
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 14,
                        paddingVertical: 8,
                        backgroundColor: pressed ? c.surface : c.bg,
                      })}
                    >
                      <View
                        style={{
                          width: 10,
                          height: 44,
                          borderRadius: 3,
                          backgroundColor: cat(category?.color ?? "slate"),
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <T variant="body" numberOfLines={1}>
                          {title}
                        </T>
                        <T variant="caption" color={c.textMuted} numberOfLines={1}>
                          {category ? `${category.emoji} ${category.name}` : "Unknown category"}
                        </T>
                      </View>
                      <T variant="rowAmount">
                        {tx.type === "income" ? "+" : ""}
                        {money(tx.amount)}
                      </T>
                    </Pressable>
                  </SwipeRow>
                </Animated.View>
              );
            })}
          </View>
        ))}
      </View>
    </LayoutAnimationConfig>
  );
}
