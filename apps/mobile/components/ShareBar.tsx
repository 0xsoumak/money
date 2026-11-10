import { View } from "react-native";
import { useMoney } from "../lib/hooks";
import type { Category } from "../lib/queries";
import { c, cat } from "../lib/theme";
import { T } from "./T";

export interface ShareItem {
  categoryId: string;
  total: number;
}

/**
 * One bar, one segment per category, widths proportional to what was spent.
 * The legend repeats every amount in words so color is never the only signal.
 */
export function ShareBar({
  items,
  categories,
  left,
}: {
  items: ShareItem[];
  categories: Category[];
  /** Minor units still available in the overall budget; adds a dashed "left" segment. */
  left?: number;
}) {
  const money = useMoney();
  const byId = new Map(categories.map((x) => [x.id, x]));
  const rows = items
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((i) => {
      const category = byId.get(i.categoryId);
      return { ...i, name: category?.name ?? "Unknown", color: category?.color ?? "slate" };
    });
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, r) => sum + r.total, 0);
  const showLeft = left !== undefined && left > 0;
  const summary = [
    ...rows.map((r) => `${r.name} ${money(r.total)}`),
    ...(showLeft ? [`Left to spend ${money(left)}`] : []),
  ].join(", ");

  return (
    <View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`Spending by category: ${summary}`}
        style={{ flexDirection: "row", height: 40, gap: 4 }}
      >
        {rows.map((r) => (
          <View
            key={r.categoryId}
            style={{
              flexGrow: r.total,
              flexBasis: 0,
              minWidth: 6,
              borderRadius: 6,
              backgroundColor: cat(r.color),
            }}
          />
        ))}
        {showLeft && (
          <View
            style={{
              flexGrow: left,
              flexBasis: 0,
              borderRadius: 6,
              borderWidth: 2,
              borderStyle: "dashed",
              borderColor: "rgba(244,244,240,0.3)",
            }}
          />
        )}
      </View>
      <View
        style={{ marginTop: 14, flexDirection: "row", flexWrap: "wrap", columnGap: 20, rowGap: 10 }}
      >
        {rows.map((r) => (
          <View key={r.categoryId} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: cat(r.color) }}
            />
            <T variant="small" size={15} style={{ fontWeight: "400" }}>
              {r.name}
            </T>
            <T variant="small" size={15} style={{ fontWeight: "700" }}>
              {money(r.total)}
            </T>
            <T variant="small" size={15} color={c.textMuted}>
              {Math.round((r.total / total) * 100)}%
            </T>
          </View>
        ))}
        {showLeft && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 3,
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: "rgba(244,244,240,0.4)",
              }}
            />
            <T variant="small" size={15}>
              Left to spend
            </T>
            <T variant="small" size={15} color={c.accent} style={{ fontWeight: "700" }}>
              {money(left)}
            </T>
          </View>
        )}
      </View>
    </View>
  );
}
