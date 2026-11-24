// Mobile twin of apps/web/src/components/charts/InvestColumns.tsx. Keep the two in step.
import { monthTitle, shortMonth } from "@money/shared";
import { View } from "react-native";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { c, fade } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney } from "./frame";

export interface InvestMonth {
  month: string;
  invested: number;
  /** Share of income invested; null without income. */
  rate: number | null;
  current: boolean;
}

const H = 130;
const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * Invested per month as bold columns: this month in lime, earlier months a dimmer lime,
 * a month with nothing invested a short grey stub. The amount sits on top; under each
 * month, the share of income. Tap a column to open that month.
 */
export function InvestColumns({
  months,
  onPick,
}: {
  months: InvestMonth[];
  onPick?: (month: string) => void;
}) {
  const money = useMoney();
  const max = Math.max(1, ...months.map((m) => m.invested));
  // Twelve columns are narrow: print amounts only on this month and the biggest one.
  const dense = months.length > 6;
  // Without income there is no share to show: drop the line rather than print dashes.
  const rates = months.some((m) => m.rate !== null);

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: dense ? 4 : 8 }}>
      {months.map((m) => {
        const empty = m.invested <= 0;
        const showAmount = !empty && (!dense || m.current || m.invested === max);
        return (
          <PressableScale
            key={m.month}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(m.month)}: ${empty ? "nothing invested" : `${money(m.invested)} invested`}${m.rate !== null ? `, ${pct(m.rate)} of income` : ""}`}
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
                height: H + 22,
                width: "100%",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              {showAmount && (
                <T
                  variant="caption"
                  size={dense ? 10 : 12}
                  color={m.current ? c.text : c.textMuted}
                  numberOfLines={1}
                  style={{ fontWeight: "700", marginBottom: 6 }}
                >
                  {compactMoney(m.invested)}
                </T>
              )}
              <View
                style={{
                  width: "100%",
                  maxWidth: 48,
                  height: empty ? 4 : Math.max(8, (m.invested / max) * H),
                  borderTopLeftRadius: empty ? 2 : dense ? 6 : 10,
                  borderTopRightRadius: empty ? 2 : dense ? 6 : 10,
                  borderBottomLeftRadius: empty ? 2 : 4,
                  borderBottomRightRadius: empty ? 2 : 4,
                  backgroundColor: empty
                    ? fade(c.text, 0.12)
                    : m.current
                      ? c.accent
                      : fade(c.accent, 0.55),
                }}
              />
            </View>
            <View style={{ alignItems: "center" }}>
              <T
                variant="caption"
                size={dense ? 10 : 12}
                color={m.current ? c.text : c.textMuted}
                style={{ fontWeight: m.current ? "700" : "600" }}
              >
                {dense ? shortMonth(m.month).slice(0, 1) : shortMonth(m.month)}
              </T>
              {!dense && rates && (
                <T variant="caption" size={11} color={c.textFaint}>
                  {m.rate !== null ? pct(m.rate) : "–"}
                </T>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
