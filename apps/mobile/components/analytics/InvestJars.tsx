// Mobile twin of apps/web/src/components/charts/InvestJars.tsx. Keep the two in step.
import { monthTitle, shortMonth } from "@money/shared";
import { View } from "react-native";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { c, fade } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney } from "./frame";

export interface Jar {
  month: string;
  invested: number;
  /** Share of income invested; null without income. */
  rate: number | null;
  current: boolean;
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/**
 * One jar per month, filled with lime up to what went in that month (the fullest month
 * fills its jar). A month with nothing invested is an empty dashed jar. Tap to open it.
 */
export function InvestJars({ jars, onPick }: { jars: Jar[]; onPick?: (month: string) => void }) {
  const money = useMoney();
  const max = Math.max(1, ...jars.map((j) => j.invested));
  // Twelve jars are narrow: print amounts only on this month and the fullest one.
  const dense = jars.length > 6;
  // Without income there is no share to show: drop the line rather than print dashes.
  const rates = jars.some((j) => j.rate !== null);

  return (
    <View style={{ flexDirection: "row", gap: dense ? 4 : 8 }}>
      {jars.map((j) => {
        const empty = j.invested <= 0;
        const fill = empty ? 0 : Math.max(6, (j.invested / max) * 100);
        const showAmount = !empty && (!dense || j.current || j.invested === max);
        return (
          <PressableScale
            key={j.month}
            scaleTo={0.95}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(j.month)}: ${empty ? "nothing invested" : `${money(j.invested)} invested`}${j.rate !== null ? `, ${pct(j.rate)} of income` : ""}`}
            onPress={
              onPick
                ? () => {
                    tap();
                    onPick(j.month);
                  }
                : undefined
            }
            style={{ flex: 1, alignItems: "center", gap: 6 }}
          >
            <T
              variant="caption"
              size={dense ? 10 : 12}
              color={empty ? c.textFaint : c.text}
              numberOfLines={1}
              style={{ fontWeight: "700" }}
            >
              {empty ? "–" : showAmount ? compactMoney(j.invested) : " "}
            </T>
            <View
              style={{
                width: "100%",
                maxWidth: 52,
                height: 110,
                borderRadius: dense ? 8 : 12,
                borderWidth: 2,
                borderStyle: empty ? "dashed" : "solid",
                borderColor: empty ? fade(c.text, 0.25) : j.current ? c.text : fade(c.text, 0.4),
                overflow: "hidden",
                justifyContent: "flex-end",
              }}
            >
              <View
                style={{
                  height: `${fill}%`,
                  backgroundColor: j.current ? c.accent : fade(c.accent, 0.7),
                  borderTopLeftRadius: 3,
                  borderTopRightRadius: 3,
                }}
              />
            </View>
            <View style={{ alignItems: "center" }}>
              <T
                variant="caption"
                size={dense ? 10 : 12}
                color={j.current ? c.text : c.textMuted}
                style={{ fontWeight: "600" }}
              >
                {dense ? shortMonth(j.month).slice(0, 1) : shortMonth(j.month)}
              </T>
              {!dense && rates && (
                <T variant="caption" size={11} color={c.textFaint}>
                  {j.rate !== null ? pct(j.rate) : "–"}
                </T>
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
