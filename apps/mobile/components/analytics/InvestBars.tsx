// Mobile twin of apps/web/src/components/charts/InvestBars.tsx. Keep the two in step.
import { monthTitle, type Ranked, shortMonth } from "@money/shared";
import { View } from "react-native";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c, cat, fade } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney } from "./frame";

const H = 170;

/**
 * Invested per month as bold stacked columns, one colour per type of investment, the
 * total on top. Below, every type with its all-time total and share. Tap a month to open it.
 */
export function InvestBars({
  months,
  allTime,
  byId,
  current,
  onPick,
}: {
  months: { month: string; parts: Ranked[] }[];
  allTime: Ranked[];
  byId: Map<string, Category>;
  current: string;
  onPick?: (month: string) => void;
}) {
  const money = useMoney();
  const order = allTime.map((r) => r.key);
  for (const m of months) for (const p of m.parts) if (!order.includes(p.key)) order.push(p.key);
  const total = (m: (typeof months)[number]) => m.parts.reduce((t, p) => t + p.amount, 0);
  const max = Math.max(1, ...months.map(total));
  const color = (key: string) => cat(byId.get(key)?.color ?? "slate");
  const allTotal = allTime.reduce((t, r) => t + r.amount, 0) || 1;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
        {months.map((m) => {
          const now = m.month === current;
          const sum = total(m);
          // Bottom to top in all-time order; the column's height is its total.
          const pieces = [...order]
            .reverse()
            .map((key) => ({ key, amount: m.parts.find((p) => p.key === key)?.amount ?? 0 }))
            .filter((p) => p.amount > 0);
          const colH = sum > 0 ? Math.max(6, (sum / max) * (H - 24)) : 3;
          return (
            <PressableScale
              key={m.month}
              scaleTo={0.95}
              accessibilityRole="button"
              accessibilityLabel={`${monthTitle(m.month)}: ${sum > 0 ? `${money(sum)} invested` : "nothing invested"}`}
              onPress={
                onPick
                  ? () => {
                      tap();
                      onPick(m.month);
                    }
                  : undefined
              }
              style={{ flex: 1, alignItems: "center", gap: 6 }}
            >
              <View
                style={{
                  height: H,
                  width: "100%",
                  justifyContent: "flex-end",
                  alignItems: "center",
                }}
              >
                {sum > 0 && (
                  <T
                    variant="caption"
                    size={11}
                    color={now ? c.text : c.textMuted}
                    numberOfLines={1}
                    style={{ fontWeight: "700", marginBottom: 6 }}
                  >
                    {compactMoney(sum)}
                  </T>
                )}
                <View
                  style={{
                    width: "100%",
                    maxWidth: 44,
                    height: colH,
                    borderTopLeftRadius: sum > 0 ? 8 : 2,
                    borderTopRightRadius: sum > 0 ? 8 : 2,
                    overflow: "hidden",
                    backgroundColor: sum > 0 ? undefined : fade(c.text, 0.12),
                    opacity: now ? 1 : 0.7,
                  }}
                >
                  {pieces.map((p, k) => (
                    <View
                      key={p.key}
                      style={{
                        flex: p.amount,
                        backgroundColor: color(p.key),
                        borderTopWidth: k > 0 ? 1 : 0,
                        borderColor: c.bg,
                      }}
                    />
                  ))}
                </View>
              </View>
              <T
                variant="caption"
                size={12}
                color={now ? c.text : c.textMuted}
                style={{ fontWeight: now ? "700" : "600" }}
              >
                {shortMonth(m.month)}
              </T>
            </PressableScale>
          );
        })}
      </View>
      <View>
        <T variant="label" size={11} color={c.textMuted} style={{ marginBottom: 4 }}>
          All time, by type
        </T>
        {allTime.map((r) => {
          const x = byId.get(r.key);
          return (
            <View
              key={r.key}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 40,
                borderBottomWidth: 1,
                borderColor: c.border,
              }}
            >
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color(r.key) }}
              />
              <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: "600" }}>
                {x ? `${x.emoji} ${x.name}` : "Unknown"}
              </T>
              <T variant="small">{money(r.amount)}</T>
              <T variant="small" color={c.textMuted} style={{ width: 40, textAlign: "right" }}>
                {Math.round((r.amount / allTotal) * 100)}%
              </T>
            </View>
          );
        })}
      </View>
    </View>
  );
}
