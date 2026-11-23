import { groupByDay, signedAmount, type TransactionType } from "@money/shared";
import { Pressable, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  LayoutAnimationConfig,
  LinearTransition,
} from "react-native-reanimated";
import { useMoney } from "../lib/hooks";
import type { Category, Tx } from "../lib/queries";
import { c, cat, radius } from "../lib/theme";
import { fade } from "./analytics/frame";
import { duration, ease } from "./motion";
import { SwipeRow } from "./SwipeRow";
import { T } from "./T";
import { SectionHeader } from "./ui";

/**
 * How each amount reads in a list. Spending is the common case, so it stays plain ink
 * (a column of red reads as alarm); income is green with a plus; investing uses the accent
 * with no minus, since the money is moved, not lost. Same as the web list.
 */
const AMOUNT: Record<TransactionType, { sign: string; color: string }> = {
  expense: { sign: "−", color: c.text },
  income: { sign: "+", color: c.success },
  investment: { sign: "", color: c.accent },
};

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
        {groups.map((g) => {
          const invested = g.items.reduce(
            (sum, t) => sum + (t.type === "investment" ? t.amount : 0),
            0,
          );
          return (
            <View key={g.date}>
              <SectionHeader
                title={g.label}
                right={
                  g.spent > 0 || invested > 0 ? (
                    <View style={{ flexDirection: "row", gap: 10, flexShrink: 1 }}>
                      {g.spent > 0 ? (
                        <T variant="small" size={13} color={c.textMuted} numberOfLines={1}>
                          {money(g.spent)} spent
                        </T>
                      ) : null}
                      {invested > 0 ? (
                        <T variant="small" size={13} color={c.textMuted} numberOfLines={1}>
                          {money(invested)} invested
                        </T>
                      ) : null}
                    </View>
                  ) : undefined
                }
              />
              <View style={{ marginTop: 6 }}>
                {g.items.map((tx) => {
                  const category = byId.get(tx.categoryId);
                  const catName = category?.name ?? "Unknown category";
                  // A note that just repeats the category adds nothing; show one line instead.
                  const note = tx.note?.trim();
                  const hasNote = !!note && note.toLowerCase() !== catName.toLowerCase();
                  const title = hasNote ? note : catName;
                  const color = cat(category?.color ?? "slate");
                  const amount = AMOUNT[tx.type];
                  const verb = signedAmount(tx.type).verb;
                  return (
                    <Animated.View
                      key={tx.id}
                      entering={FadeIn.duration(duration.base).easing(ease)}
                      exiting={FadeOut.duration(duration.fast)}
                      layout={LinearTransition.duration(duration.base).easing(ease)}
                    >
                      <SwipeRow onEdit={() => onEdit(tx)} onDelete={() => onDelete(tx)}>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${title}, ${verb} ${money(tx.amount)}`}
                          accessibilityHint="Swipe left to delete"
                          accessibilityActions={[{ name: "delete", label: "Delete" }]}
                          onAccessibilityAction={(e) => {
                            if (e.nativeEvent.actionName === "delete") onDelete(tx);
                          }}
                          onPress={() => onEdit(tx)}
                          style={({ pressed }) => ({
                            minHeight: 64,
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 14,
                            paddingVertical: 8,
                            borderRadius: radius.lg,
                            backgroundColor: pressed ? c.surface : c.bg,
                          })}
                        >
                          <View
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 12,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: fade(color, 0.18),
                              borderWidth: 1.5,
                              borderColor: fade(color, 0.35),
                            }}
                          >
                            <T variant="body" size={20}>
                              {category?.emoji ?? "?"}
                            </T>
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <T variant="body" size={16} numberOfLines={1}>
                              {title}
                            </T>
                            {hasNote ? (
                              <View
                                style={{
                                  flexDirection: "row",
                                  alignItems: "center",
                                  gap: 6,
                                  marginTop: 2,
                                }}
                              >
                                <View
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 4,
                                    backgroundColor: color,
                                  }}
                                />
                                <T
                                  variant="caption"
                                  color={c.textMuted}
                                  numberOfLines={1}
                                  style={{ flexShrink: 1 }}
                                >
                                  {catName}
                                </T>
                              </View>
                            ) : null}
                          </View>
                          <T variant="rowAmount" size={18} color={amount.color}>
                            {amount.sign}
                            {money(tx.amount)}
                          </T>
                        </Pressable>
                      </SwipeRow>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </LayoutAnimationConfig>
  );
}
