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

export interface BulletRow {
  key: string;
  name: string;
  spent: number;
  limit: number;
}

const BAR_H = 26;

/**
 * Budgets as bullet bars on one shared scale: every bar is measured against its own limit,
 * so the limit line sits at the same place on every row. Over budget, the bar runs on past
 * the line in red, so 227% reaches much further than 108%. The notch marks where spending
 * should be by today. Tap a row to edit it.
 */
export function BudgetBullets({
  rows,
  pace,
  onPick,
}: {
  rows: BulletRow[];
  pace?: number | null;
  onPick?: (row: BulletRow) => void;
}) {
  const money = useMoney();
  // The scale runs a little past the furthest bar, at least to 120% and at most to 250%.
  const top = Math.min(
    2.5,
    Math.max(1.2, ...rows.map((r) => budgetProgress(r.spent, r.limit).ratio * 1.05)),
  );
  const at = (ratio: number) => (Math.min(ratio, top) / top) * 100;
  const paceAt = pace != null && pace > 0 && pace < 1 ? pace : null;
  const mark = (ratio: number, w: number) =>
    ({ position: "absolute", left: `${at(ratio)}%`, marginLeft: -w / 2, width: w }) as const;

  return (
    <View>
      {/* The scale: where the limit is, and where today's pace is. */}
      <View style={{ height: 18, marginBottom: 2 }} importantForAccessibility="no-hide-descendants">
        <View style={[mark(1, 60), { alignItems: "center" }]}>
          <T variant="label" size={10} color={c.textMuted}>
            Limit
          </T>
        </View>
        {paceAt !== null && (
          <View style={[mark(paceAt, 60), { alignItems: "center" }]}>
            <T variant="label" size={10} color={c.textFaint}>
              Today
            </T>
          </View>
        )}
      </View>
      {rows.map((r) => {
        const p = budgetProgress(r.spent, r.limit);
        const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
        const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;
        const color = STATE_COLOR[p.state];
        return (
          <PressableScale
            key={r.key}
            disabled={!onPick}
            onPress={onPick ? () => onPick(r) : undefined}
            scaleTo={0.98}
            accessibilityRole={onPick ? "button" : "image"}
            accessibilityLabel={`${onPick ? "Edit " : ""}${r.name}: ${pct}% used, ${money(r.spent)} of ${money(r.limit)}, ${status}`}
            style={{ paddingVertical: 12, gap: 10 }}
          >
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T variant="body" size={16} numberOfLines={1}>
                  {r.name}
                </T>
                <T variant="caption" color={c.textMuted} numberOfLines={1}>
                  {money(r.spent)} of {money(r.limit)}
                </T>
              </View>
              <View style={{ alignItems: "flex-end", gap: 2 }}>
                <T variant="title" size={17} color={color}>
                  {status}
                </T>
                <T variant="caption" color={color} style={{ fontWeight: "600" }}>
                  {pct}%
                </T>
              </View>
            </View>
            <View style={{ height: BAR_H }}>
              {/* The limit's worth of track, and a fainter stretch past it. */}
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: `${at(1)}%`,
                  backgroundColor: c.surfaceStrong,
                  borderTopLeftRadius: 3,
                  borderBottomLeftRadius: 3,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  right: 0,
                  left: `${at(1)}%`,
                  backgroundColor: c.surface,
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                }}
              />
              {r.spent > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: 0,
                    width: `${at(p.ratio)}%`,
                    minWidth: 6,
                    backgroundColor: color,
                    borderTopLeftRadius: 3,
                    borderBottomLeftRadius: 3,
                    borderTopRightRadius: 6,
                    borderBottomRightRadius: 6,
                  }}
                />
              )}
              {/* The limit line, cut through the bar in the page colour so it shows on red too. */}
              <View
                style={[
                  mark(1, 3),
                  { top: -6, bottom: -6, borderRadius: 2, backgroundColor: c.bg },
                ]}
              />
              <View
                style={[
                  mark(1, 1.5),
                  { top: -6, bottom: -6, borderRadius: 1, backgroundColor: c.text },
                ]}
              />
              {paceAt !== null && (
                <View
                  style={[
                    mark(paceAt, 2.5),
                    { top: 5, bottom: 5, borderRadius: 2, backgroundColor: c.bg, opacity: 0.8 },
                  ]}
                />
              )}
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}
