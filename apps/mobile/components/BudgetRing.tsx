// Mobile twin of apps/web/src/components/BudgetRing.tsx. Keep the two in step.
import { type BudgetState, budgetProgress } from "@money/shared";
import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { useMoney } from "../lib/hooks";
import { c } from "../lib/theme";
import { PressableScale } from "./motion";
import { T } from "./T";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const STATE_COLOR: Record<BudgetState, string> = {
  ok: c.text,
  warning: c.warning,
  over: c.danger,
};

/**
 * The progress ring, percentage in the middle. Over budget, the ring is a faded
 * full lap and the solid arc is the overspend (a second lap), so 108% and 227%
 * look different. Sweeps in when the value changes.
 */
export function Ring({
  spent,
  limit,
  size,
  stroke,
  fontSize,
}: {
  spent: number;
  limit: number;
  size: number;
  stroke: number;
  fontSize: number;
}) {
  const p = budgetProgress(spent, limit);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isOver = p.state === "over";
  const lap = isOver ? Math.min(p.ratio - 1, 1) : p.ratio;
  const target = spent > 0 ? Math.min(1, Math.max(lap, 0.02)) : 0;
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(target, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [target, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  return (
    <View style={{ width: size, height: size }} importantForAccessibility="no-hide-descendants">
      <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke={isOver ? c.danger : c.surfaceStrong}
          strokeOpacity={isOver ? 0.3 : 1}
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={STATE_COLOR[p.state]}
          strokeDasharray={`${circ} ${circ}`}
          animatedProps={animatedProps}
        />
      </Svg>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <T variant="title" size={fontSize} color={STATE_COLOR[p.state]}>
          {pct}%
        </T>
      </View>
    </View>
  );
}

/**
 * A compact budget card: ring on the left, name and figures in the middle,
 * status in words on the right. With `onPress` the whole card is a button.
 */
export function BudgetRing({
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
  const p = budgetProgress(spent, limit);
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
  const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;

  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      scaleTo={0.98}
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={`${onPress ? "Edit " : ""}${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${status}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderWidth: 2,
        borderColor: c.border,
        borderRadius: 14,
      }}
    >
      <Ring spent={spent} limit={limit} size={54} stroke={6} fontSize={14} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="body" size={16} numberOfLines={1}>
          {name}
        </T>
        <T variant="caption" color={c.textMuted} numberOfLines={1}>
          {money(spent)} of {money(limit)}
        </T>
      </View>
      <T variant="title" size={17} color={STATE_COLOR[p.state]}>
        {status}
      </T>
    </PressableScale>
  );
}
