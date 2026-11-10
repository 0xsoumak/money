import { Feather } from "@expo/vector-icons";
import { groupByDay } from "@money/shared";
import { Pressable, View } from "react-native";
import { useMoney } from "../lib/hooks";
import type { Category, Tx } from "../lib/queries";
import { c, cat } from "../lib/theme";
import { T } from "./T";
import { IconButton, SectionHeader } from "./ui";

/** Transactions grouped by day, newest first. Tap a row to edit it. */
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
              <View
                key={tx.id}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderBottomWidth: 1,
                  borderBottomColor: c.border,
                }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${title}, ${money(tx.amount)}`}
                  onPress={() => onEdit(tx)}
                  style={({ pressed }) => ({
                    flex: 1,
                    minHeight: 68,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 14,
                    paddingVertical: 8,
                    opacity: pressed ? 0.6 : 1,
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
                <IconButton label={`Delete ${title}`} onPress={() => onDelete(tx)}>
                  <Feather name="trash-2" size={18} color={c.textMuted} />
                </IconButton>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
