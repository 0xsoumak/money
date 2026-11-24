// Mobile twin of apps/web/src/components/charts/InvestBars.tsx. Keep the two in step.
import { monthTitle, shortMonth } from "@money/shared";
import { View } from "react-native";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { c, fade } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney } from "./frame";

const H = 170;

/**
 * Invested per month as bold columns: the month being viewed in lime, the rest in grey,
 * the amount on every month that had one. Empty months leave a faint stub. Tap to open one.
 */
export function InvestBars({
  months,
  current,
  onPick,
}: {
  months: { month: string; invested: number }[];
  current: string;
  onPick?: (month: string) => void;
}) {
  const money = useMoney();
  const max = Math.max(1, ...months.map((m) => m.invested));

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
      {months.map((m) => {
        const now = m.month === current;
        const empty = m.invested <= 0;
        return (
          <PressableScale
            key={m.month}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(m.month)}: ${empty ? "nothing invested" : `${money(m.invested)} invested`}`}
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
              style={{ height: H, width: "100%", justifyContent: "flex-end", alignItems: "center" }}
            >
              {!empty && (
                <T
                  variant="caption"
                  size={11}
                  color={now ? c.text : c.textMuted}
                  numberOfLines={1}
                  style={{ fontWeight: "700", marginBottom: 6 }}
                >
                  {compactMoney(m.invested)}
                </T>
              )}
              <View
                style={{
                  width: "100%",
                  maxWidth: 44,
                  height: empty ? 3 : Math.max(6, (m.invested / max) * (H - 24)),
                  backgroundColor: empty ? fade(c.text, 0.12) : now ? c.accent : fade(c.text, 0.42),
                  borderTopLeftRadius: empty ? 2 : 8,
                  borderTopRightRadius: empty ? 2 : 8,
                }}
              />
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
  );
}
