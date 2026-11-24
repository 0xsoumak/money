// Mobile twin of apps/web/src/components/BudgetRing.tsx. Keep the two in step.
import { type BudgetState, budgetProgress } from "@money/shared";
import { type ReactNode, useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import Svg, { G, Line, Path } from "react-native-svg";
import { useMoney } from "../lib/hooks";
import { c, fade } from "../lib/theme";
import { PressableScale } from "./motion";
import { T } from "./T";

const AnimatedPath = Animated.createAnimatedComponent(Path);

export const STATE_COLOR: Record<BudgetState, string> = {
  ok: c.text,
  warning: c.warning,
  over: c.danger,
};

/**
 * A half donut: the arc fills left to right with the share of the budget used, `children`
 * sits in the bowl. Over budget, the whole arc turns red and a bar underneath grows with the
 * overspend, so 108% and 227% look different. `pace` (0–1) adds a tick where spending would
 * be if it kept exactly to the budget today. Sweeps in when the value changes.
 */
export function HalfRing({
  spent,
  limit,
  width,
  stroke,
  pace,
  children,
}: {
  spent: number;
  limit: number;
  width: number;
  stroke: number;
  pace?: number | null;
  children?: ReactNode;
}) {
  const p = budgetProgress(spent, limit);
  const r = (width - stroke) / 2 - 4;
  const cx0 = width / 2;
  const cy0 = r + stroke / 2 + 4;
  const height = cy0 + stroke / 2 + 2;
  const len = Math.PI * r;
  const target = spent > 0 ? Math.min(1, Math.max(p.ratio, 0.02)) : 0;
  const arc = `M ${cx0 - r},${cy0} A ${r} ${r} 0 0 1 ${cx0 + r},${cy0}`;
  const isOver = p.state === "over";

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [target, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: len * (1 - progress.value),
  }));

  // The pace tick, across the band at its angle (left end is 0, right end is 1).
  const tick =
    pace != null && pace > 0 && pace < 1
      ? (() => {
          const a = Math.PI * (1 - pace);
          const at = (rad: number) => [cx0 + rad * Math.cos(a), cy0 - rad * Math.sin(a)] as const;
          const [x1, y1] = at(r - stroke / 2 - 4);
          const [x2, y2] = at(r + stroke / 2 + 4);
          return { x1, y1, x2, y2 };
        })()
      : null;
  // Overspend as a share of the limit, capped at one more full budget (200%).
  const overflow = isOver ? Math.min(Math.max(p.ratio - 1, 0), 1) : 0;

  return (
    <View style={{ width, alignItems: "center", gap: 10 }}>
      <View style={{ width, height }} importantForAccessibility="no-hide-descendants">
        <Svg width={width} height={height}>
          <Path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={isOver ? c.danger : c.surfaceStrong}
            strokeOpacity={isOver ? 0.3 : 1}
          />
          <AnimatedPath
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={STATE_COLOR[p.state]}
            strokeDasharray={`${len} ${len}`}
            animatedProps={animatedProps}
          />
          {tick && (
            <G>
              <Line {...tick} strokeWidth={5} strokeLinecap="round" stroke={c.bg} />
              <Line {...tick} strokeWidth={2.5} strokeLinecap="round" stroke={c.text} />
            </G>
          )}
        </Svg>
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }}>
          {children}
        </View>
      </View>
      {overflow > 0 && (
        <View
          style={{
            width: "100%",
            height: 6,
            borderRadius: 3,
            overflow: "hidden",
            backgroundColor: fade(c.danger, 0.2),
          }}
        >
          <View
            style={{
              width: `${Math.max(4, overflow * 100)}%`,
              height: "100%",
              borderRadius: 3,
              backgroundColor: c.danger,
            }}
          />
        </View>
      )}
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
