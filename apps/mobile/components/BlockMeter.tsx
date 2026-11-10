import { type BudgetState, budgetProgress, dataviz } from "@money/shared";
import { useEffect, useRef } from "react";
import { Animated, Pressable, View } from "react-native";
import { useMoney } from "../lib/hooks";
import { c } from "../lib/theme";
import { T } from "./T";

const FILL: Record<BudgetState, string> = { ok: c.text, warning: c.warning, over: c.danger };
const STATUS: Record<BudgetState, string> = { ok: c.textMuted, warning: c.warning, over: c.danger };

/** One block that lights up (after `delay` ms) when `on` becomes true. */
function Block({ on, color, delay }: { on: boolean; color: string; delay: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: on ? 1 : 0,
      duration: 220,
      delay: on ? delay : 0,
      useNativeDriver: true,
    }).start();
  }, [on, delay, opacity]);
  return (
    <View
      style={{ flex: 1, borderRadius: 3, backgroundColor: c.surfaceStrong, overflow: "hidden" }}
    >
      <Animated.View style={{ flex: 1, backgroundColor: color, opacity }} />
    </View>
  );
}

/** The 10-block meter. Blocks light up in turn when it first shows or changes. */
export function BlockMeter({
  spent,
  limit,
  label,
}: {
  spent: number;
  limit: number;
  label: string;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const description =
    p.over > 0
      ? `${label}: ${money(spent)} of ${money(limit)}, ${money(p.over)} over`
      : `${label}: ${money(spent)} of ${money(limit)}, ${money(p.remaining)} left`;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={description}
      style={{ flexDirection: "row", gap: 3, height: dataviz.meterBlockHeight }}
    >
      {Array.from({ length: dataviz.meterBlocks }, (_, i) => (
        <Block key={`${label}-${i}`} on={i < p.filled} color={FILL[p.state]} delay={i * 35} />
      ))}
    </View>
  );
}

/** "₹1,680 left" or "₹60 over", colored by state. Words always accompany the color. */
export function BudgetStatus({
  spent,
  limit,
  size = 16,
}: {
  spent: number;
  limit: number;
  size?: number;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  return (
    <T variant="small" size={size} color={STATUS[p.state]} style={{ fontWeight: "700" }}>
      {p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`}
    </T>
  );
}

/** One budget line: name and status, the meter, and the exact figures. */
export function BudgetRow({
  name,
  spent,
  limit,
  onPress,
}: {
  name: string;
  spent: number;
  limit: number;
  onPress?: () => void;
}) {
  const money = useMoney();
  const body = (
    <View style={{ paddingVertical: 14, gap: 8 }}>
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
        }}
      >
        <T variant="body" size={16} numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </T>
        <BudgetStatus spent={spent} limit={limit} />
      </View>
      <BlockMeter spent={spent} limit={limit} label={name} />
      <T variant="caption" color={c.textMuted}>
        {money(spent)} of {money(limit)}
      </T>
    </View>
  );
  const rule = { borderBottomWidth: 1, borderBottomColor: c.border } as const;
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Edit ${name} budget`}
      onPress={onPress}
      style={rule}
    >
      {body}
    </Pressable>
  ) : (
    <View style={rule}>{body}</View>
  );
}
