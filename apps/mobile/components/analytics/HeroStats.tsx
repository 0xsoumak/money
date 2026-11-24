// Mobile twin of apps/web/src/components/analytics/HeroStats.tsx. Keep the two in step.
import type { HeroStat, Tone } from "@money/shared";
import { View } from "react-native";
import { c } from "../../lib/theme";
import { T } from "../T";

export const toneColor = (tone: Tone | undefined) =>
  tone === "warn" ? c.danger : tone === "good" ? c.accent : c.textMuted;

/** The month in four big numbers, two by two, divided by hairlines. */
export function HeroStats({ stats }: { stats: HeroStat[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        borderTopWidth: 2,
        borderBottomWidth: 2,
        borderColor: c.borderStrong,
        paddingVertical: 18,
        rowGap: 22,
      }}
    >
      {stats.map((s, i) => (
        <View
          key={s.label}
          accessible
          accessibilityLabel={`${s.label}: ${s.value}${s.sub ? `. ${s.sub}` : ""}`}
          style={{
            width: "50%",
            gap: 6,
            paddingRight: i % 2 === 0 ? 12 : 0,
            paddingLeft: i % 2 === 1 ? 14 : 0,
            borderLeftWidth: i % 2 === 1 ? 2 : 0,
            borderColor: c.border,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            {s.accent && (
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.accent }} />
            )}
            <T variant="label" size={11} color={c.textMuted} numberOfLines={1}>
              {s.label}
            </T>
          </View>
          <T variant="title" size={28} fit>
            {s.value}
          </T>
          {s.sub ? (
            <T variant="caption" color={toneColor(s.tone)} numberOfLines={2}>
              {s.sub}
            </T>
          ) : null}
        </View>
      ))}
    </View>
  );
}
