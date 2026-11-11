import { type BudgetState, budgetProgress, monthTitle, type StatItem } from "@money/shared";
import { useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle } from "react-native-svg";
import { select } from "../lib/haptics";
import { useMoney } from "../lib/hooks";
import type { TrendMonth } from "../lib/queries";
import { c } from "../lib/theme";
import { BudgetStatus } from "./BlockMeter";
import { PressableScale } from "./motion";
import { Label, T } from "./T";

const CHART_H = 132;

const shortMonth = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleString("en", { month: "short" });

/** A bar that grows from the baseline to `height` with a spring, after `delay` ms. */
function Bar({ height, color, delay }: { height: number; color: string; delay: number }) {
  const h = useSharedValue(0);
  useEffect(() => {
    h.value = withDelay(delay, withSpring(height, { damping: 17, stiffness: 170 }));
  }, [height, delay, h]);
  const style = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <Animated.View
      style={[
        { width: "100%", backgroundColor: color, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
        style,
      ]}
    />
  );
}

/** A dashed horizontal line made of short dashes (RN's dashed borders are unreliable on Android). */
function DashedLine({ width }: { width: number }) {
  const n = Math.max(0, Math.floor(width / 8));
  return (
    <View style={{ flexDirection: "row", gap: 4, overflow: "hidden" }}>
      {Array.from({ length: n }, (_, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: 2,
            borderRadius: 1,
            backgroundColor: c.textMuted,
            opacity: 0.6,
          }}
        />
      ))}
    </View>
  );
}

/**
 * One bar per day. Today is lime, days ahead are flat stubs, and a dashed
 * line marks the daily pace that lands on the overall budget. Touch or drag
 * across the chart to read any day; a faint haptic ticks per day.
 */
export function DailyBars({
  month,
  totals,
  todayDate,
  dailyBudget,
  days: n,
}: {
  month: string;
  totals: Map<string, number>;
  todayDate: string;
  dailyBudget: number | null;
  days: number;
}) {
  const money = useMoney();
  const [width, setWidth] = useState(0);
  const [sel, setSel] = useState<number | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);

  const days = Array.from({ length: n }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, date, total: totals.get(date) ?? 0, future: date > todayDate };
  });
  const peak = days.reduce((best, d) => (d.total > best.total ? d : best));
  const max = Math.max(peak.total, dailyBudget ?? 0, 1);
  const h = (v: number) => (v / max) * CHART_H;

  const pick = (x: number) => {
    if (!width) return;
    const i = Math.min(n - 1, Math.max(0, Math.floor((x / width) * n)));
    if (i !== sel) {
      select();
      setSel(i);
    }
    if (clear.current) clearTimeout(clear.current);
  };
  const release = () => {
    clear.current = setTimeout(() => setSel(null), 2500);
  };
  useEffect(() => () => void (clear.current && clearTimeout(clear.current)), []);

  const shown = sel !== null ? days[sel] : undefined;
  const spentDays = days.filter((d) => d.total > 0).length;

  return (
    <View style={{ gap: 12 }}>
      {/* Readout: the touched day, or the biggest day by default. */}
      <View
        style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}
      >
        <T variant="small" color={c.textMuted}>
          {shown
            ? `${shown.day} ${shortMonth(month)}`
            : peak.total > 0
              ? "Biggest day"
              : "No spending yet"}
        </T>
        <T variant="title" size={20}>
          {shown
            ? shown.future
              ? "Ahead"
              : money(shown.total)
            : peak.total > 0
              ? money(peak.total)
              : ""}
        </T>
      </View>

      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={
          peak.total > 0
            ? `Daily spending. Biggest day ${peak.day} ${monthTitle(month)}, ${money(peak.total)}. Spent on ${spentDays} of ${n} days.`
            : "No spending yet this month"
        }
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={{ height: CHART_H }}
      >
        <View style={{ flex: 1, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
          {days.map((d, i) => (
            <View
              key={d.date}
              style={{ flex: 1, alignItems: "stretch", justifyContent: "flex-end" }}
            >
              <Bar
                height={d.future ? 3 : d.total > 0 ? Math.max(h(d.total), 4) : 2}
                delay={i * 12}
                color={
                  d.future
                    ? c.surface
                    : sel === i
                      ? c.text
                      : d.date === todayDate
                        ? c.accent
                        : "rgba(244,244,240,0.6)"
                }
              />
            </View>
          ))}
        </View>
        {dailyBudget !== null && dailyBudget > 0 && width > 0 && (
          <View
            pointerEvents="none"
            style={{ position: "absolute", left: 0, right: 0, bottom: h(dailyBudget) }}
          >
            <DashedLine width={width} />
          </View>
        )}
        {/* Touch layer on top so locationX is measured across the whole chart. */}
        <View
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
          onStartShouldSetResponder={() => true}
          onMoveShouldSetResponder={() => true}
          onResponderGrant={(e) => pick(e.nativeEvent.locationX)}
          onResponderMove={(e) => pick(e.nativeEvent.locationX)}
          onResponderRelease={release}
          onResponderTerminate={release}
          // Let the page scroll take over on a vertical swipe.
          onResponderTerminationRequest={() => true}
        />
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {[1, Math.ceil(n / 2), n].map((day) => (
          <T key={day} variant="caption" color={c.textMuted}>
            {day}
          </T>
        ))}
      </View>
      {dailyBudget !== null && dailyBudget > 0 && (
        <T variant="caption" color={c.textMuted}>
          Dashed line: budget pace {money(dailyBudget)}/day
        </T>
      )}
    </View>
  );
}

/** Six months, one bar each, amount on top. The viewed month is lime; tap a bar to open it. */
export function MonthTrend({
  months,
  current,
  onPick,
}: {
  months: TrendMonth[];
  current: string;
  onPick: (month: string) => void;
}) {
  const money = useMoney();
  const max = Math.max(...months.map((m) => m.spent), 1);
  const H = CHART_H - 24;
  return (
    <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
      {months.map((m, i) => {
        const selected = m.month === current;
        return (
          <PressableScale
            key={m.month}
            accessibilityRole="button"
            accessibilityLabel={`${monthTitle(m.month)}: spent ${money(m.spent)}`}
            accessibilityState={{ selected }}
            onPress={() => {
              select();
              onPick(m.month);
            }}
            style={{ flex: 1, alignItems: "stretch", gap: 6 }}
          >
            <T
              variant="caption"
              size={10.5}
              color={selected ? c.text : c.textMuted}
              numberOfLines={1}
              adjustsFontSizeToFit
              style={{ textAlign: "center", fontWeight: "700" }}
            >
              {m.spent > 0 ? money(m.spent) : "–"}
            </T>
            <View style={{ height: H, justifyContent: "flex-end" }}>
              <Bar
                height={m.spent > 0 ? Math.max((m.spent / max) * H, 4) : 2}
                delay={i * 50}
                color={selected ? c.accent : c.surfaceStrong}
              />
            </View>
            <T
              variant="caption"
              color={selected ? c.text : c.textMuted}
              style={{ textAlign: "center", fontWeight: selected ? "700" : "400" }}
            >
              {shortMonth(m.month)}
            </T>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** The four overview stats in a 2×2 grid. */
export function StatGrid({ stats }: { stats: StatItem[] }) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        borderWidth: 2,
        borderColor: c.border,
        borderRadius: 14,
        overflow: "hidden",
      }}
    >
      {stats.map((s, i) => (
        <View
          key={s.label}
          style={{
            width: "50%",
            padding: 14,
            gap: 2,
            borderColor: c.border,
            borderRightWidth: i % 2 === 0 ? 1 : 0,
            borderBottomWidth: i < 2 ? 1 : 0,
          }}
        >
          <T variant="label" size={11} color={c.textMuted}>
            {s.label}
          </T>
          <T
            variant="title"
            size={20}
            fit
            color={s.tone === "danger" ? c.danger : undefined}
            style={{ marginTop: 2 }}
          >
            {s.value}
          </T>
          <T variant="caption" color={c.textMuted} numberOfLines={2}>
            {s.hint}
          </T>
        </View>
      ))}
    </View>
  );
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const RING: Record<BudgetState, string> = { ok: c.text, warning: c.warning, over: c.danger };

/**
 * Progress ring for one budget, same rules as the web: percent inside, words
 * and figures below. Over budget, the overspend is drawn as a second lap on a
 * faded full ring so 108% and 227% look different.
 */
export function BudgetRing({
  name,
  spent,
  limit,
  size = 92,
  onPress,
}: {
  name: string;
  spent: number;
  limit: number;
  size?: number;
  onPress?: () => void;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const stroke = Math.round(size / 9);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isOver = p.state === "over";
  const lap = isOver ? Math.min(p.ratio - 1, 1) : p.ratio;
  const target = spent > 0 ? Math.min(1, Math.max(lap, 0.02)) : 0;
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;

  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(target, { duration: 800, easing: Easing.out(Easing.cubic) });
  }, [target, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circ * (1 - progress.value),
  }));

  const description =
    p.over > 0
      ? `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${money(p.over)} over`
      : `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${money(p.remaining)} left`;

  return (
    <PressableScale
      disabled={!onPress}
      onPress={onPress}
      accessibilityRole={onPress ? "button" : "image"}
      accessibilityLabel={description}
      style={{
        flex: 1,
        alignItems: "center",
        gap: 10,
        padding: 14,
        borderWidth: 2,
        borderColor: c.border,
        borderRadius: 14,
      }}
    >
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            stroke={isOver ? c.danger : c.surfaceStrong}
            strokeOpacity={isOver ? 0.35 : 1}
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={RING[p.state]}
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
          <T variant="title" size={18} color={RING[p.state]}>
            {pct}%
          </T>
        </View>
      </View>
      <View style={{ alignItems: "center", gap: 2, alignSelf: "stretch" }}>
        <T variant="body" size={15} numberOfLines={1} style={{ fontWeight: "600" }}>
          {name}
        </T>
        <BudgetStatus spent={spent} limit={limit} size={13} />
        <T variant="caption" color={c.textMuted} numberOfLines={1} adjustsFontSizeToFit>
          {money(spent)} of {money(limit)}
        </T>
      </View>
    </PressableScale>
  );
}
