// Mobile twin of CategoryDonut in apps/web/src/components/charts/Explore.tsx. Keep the two in step.
import type { Ranked } from "@money/shared";
import { arc, pie } from "d3-shape";
import { useState } from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { select } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { c } from "../../lib/theme";
import { PressableScale } from "../motion";
import { T } from "../T";
import { compactMoney, seriesOf } from "./frame";

const SIZE = 240;

/**
 * Where spending usually goes, as a donut with gaps between slices. The total sits in
 * the middle; tap a slice's row underneath to read it out in the centre.
 */
export function CategoryDonut({
  share,
  byId,
  center = "Spent",
}: {
  share: Ranked[];
  byId: Map<string, Category>;
  /** The word over the total in the middle. */
  center?: string;
}) {
  const money = useMoney();
  const [sel, setSel] = useState<number | null>(null);
  const total = share.reduce((t, r) => t + r.amount, 0) || 1;
  const slices = share.map((r) => ({ ...seriesOf(r.key, byId), value: r.amount }));
  const emoji = (key: string) => byId.get(key)?.emoji;

  const r = SIZE / 2;
  const arcs = pie<(typeof slices)[number]>()
    .value((s) => s.value)
    .sort(null)
    .padAngle(0.05)(slices);
  const shape = (grow: number) =>
    arc<(typeof arcs)[number]>()
      .innerRadius(r * 0.62)
      .outerRadius(r * 0.92 + grow)
      .cornerRadius(6);
  const pctOf = (v: number) => `${Math.round((v / total) * 100)}%`;
  const picked = sel !== null ? slices[sel] : undefined;

  return (
    <View style={{ gap: 18 }}>
      <View style={{ alignSelf: "center", width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE}>
          <G x={r} y={r}>
            {arcs.map((a, i) => (
              <Path
                key={a.data.key}
                d={shape(sel === i ? 6 : 0)(a) ?? ""}
                fill={a.data.color}
                opacity={sel === null || sel === i ? 1 : 0.35}
                onPress={() => {
                  select();
                  setSel(sel === i ? null : i);
                }}
              />
            ))}
          </G>
        </Svg>
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            inset: 0,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: SIZE * 0.2,
          }}
        >
          <T variant="caption" color={c.textMuted} numberOfLines={1}>
            {picked ? picked.name : center}
          </T>
          <T variant="title" size={30} fit>
            {picked ? pctOf(picked.value) : compactMoney(total)}
          </T>
        </View>
      </View>
      <View>
        {slices.map((s, i) => (
          <PressableScale
            key={s.key}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityState={{ selected: sel === i }}
            accessibilityLabel={`${s.name}: ${money(s.value)}, ${pctOf(s.value)}`}
            onPress={() => {
              select();
              setSel(sel === i ? null : i);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              minHeight: 44,
              borderBottomWidth: 1,
              borderColor: c.border,
              opacity: sel === null || sel === i ? 1 : 0.5,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
            <T variant="small" numberOfLines={1} style={{ flex: 1, fontWeight: "600" }}>
              {emoji(s.key) ? `${emoji(s.key)} ` : ""}
              {s.name}
            </T>
            <T variant="small">{money(s.value)}</T>
            <T variant="small" color={c.textMuted} style={{ width: 40, textAlign: "right" }}>
              {pctOf(s.value)}
            </T>
          </PressableScale>
        ))}
      </View>
    </View>
  );
}
