// Mobile twin of apps/web/src/routes/_app/analytics.tsx: the same sections, in the same
// order, worded by the same shared takeaways. Keep the two in step.
import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsRow,
  analyticsWindow,
  categoryShare,
  type Decisions,
  dailyExpenses,
  dayStats,
  decisions,
  heroStats,
  investingTakeaway,
  type MonthTotals,
  moneyFlow,
  moneyFlowTakeaway,
  OTHER,
  spendCurve,
  spendingTakeaway,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { CalendarHeat } from "../../components/analytics/CalendarHeat";
import { CategoryDonut } from "../../components/analytics/CategoryDonut";
import { ChartSection, compactMoney, fade } from "../../components/analytics/frame";
import { HeroStats } from "../../components/analytics/HeroStats";
import { InvestJars, type Jar } from "../../components/analytics/InvestJars";
import { MoneyFlow } from "../../components/analytics/MoneyFlow";
import { type MonthRow, MonthRows } from "../../components/analytics/MonthRows";
import { RateGauge } from "../../components/analytics/RateGauge";
import { SpendCurve } from "../../components/analytics/SpendCurve";
import { WeekdayBars } from "../../components/analytics/WeekdayBars";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { PressableScale, Reveal } from "../../components/motion";
import { Screen } from "../../components/Screen";
import { Label, T } from "../../components/T";
import { Button, EmptyState, Skeleton } from "../../components/ui";
import { tap } from "../../lib/haptics";
import { useMoney } from "../../lib/hooks";
import { useMonth } from "../../lib/month";
import { analyticsQuery, type Category, categoriesQuery, summaryQuery } from "../../lib/queries";
import { c } from "../../lib/theme";

const pct = (r: number) => `${Math.round(r * 100)}%`;

export default function Analytics() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month, setMonth } = useMonth();
  const [range, setRange] = useState<AnalyticsRange>(6);
  const todayDate = today();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const q = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const byId = useMemo(
    () => new Map<string, Category>(categories.map((x) => [x.id, x])),
    [categories],
  );
  const fixedIds = useMemo(
    () => new Set(categories.filter((x) => x.fixed).map((x) => x.id)),
    [categories],
  );

  const budgets = summary.data?.budget;
  // While the next month loads, keep computing for the month the rows belong to.
  const d = useMemo(
    () =>
      q.data
        ? decisions({
            rows: q.data.rows,
            month: q.data.to,
            range,
            todayDate,
            budgets: {
              overall: budgets?.overall ?? null,
              byCategory: budgets?.categories ?? {},
            },
            fixedIds,
          })
        : null,
    [q.data, range, todayDate, budgets, fixedIds],
  );

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["analytics"] })}
    >
      <MonthSwitcher />
      <View
        accessibilityState={{ busy: q.isPlaceholderData }}
        pointerEvents={q.isPlaceholderData ? "none" : "auto"}
        style={{ gap: 44, opacity: q.isPlaceholderData ? 0.35 : 1 }}
      >
        <View style={{ gap: 18 }}>
          <View style={{ gap: 4 }}>
            <Label>
              {d
                ? d.confidence === "none"
                  ? "This month only"
                  : `Compared with your last ${d.history.length} ${d.history.length === 1 ? "month" : "months"}`
                : " "}
            </Label>
            <T variant="display" size={52} accessibilityRole="header">
              Analytics
            </T>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Compare with the last"
            style={{
              flexDirection: "row",
              alignSelf: "flex-start",
              gap: 3,
              padding: 3,
              borderWidth: 2,
              borderColor: c.border,
              borderRadius: 12,
            }}
          >
            {ANALYTICS_RANGES.map((r) => (
              <PressableScale
                key={r}
                accessibilityRole="radio"
                accessibilityState={{ selected: range === r }}
                onPress={() => {
                  tap();
                  setRange(r);
                }}
                scaleTo={0.95}
                style={{
                  minWidth: 56,
                  minHeight: 40,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 9,
                  backgroundColor: range === r ? c.text : "transparent",
                }}
              >
                <T variant="label" size={13} color={range === r ? c.bg : c.textMuted}>
                  {r}M
                </T>
              </PressableScale>
            ))}
          </View>
        </View>

        {q.isPending ? (
          <Skeleton style={{ height: 320 }} />
        ) : q.data?.rows.length === 0 ? (
          <EmptyState
            title="Nothing to analyse yet"
            hint="Charts fill in as you log expenses, income and investments."
            action={<Button title="Add expense" onPress={() => router.push("/add")} />}
          />
        ) : (
          d &&
          q.data && (
            <Sections
              d={d}
              rows={q.data.rows}
              byId={byId}
              range={range}
              todayDate={todayDate}
              budget={budgets?.overall ?? null}
              onPick={setMonth}
            />
          )
        )}
      </View>
    </Screen>
  );
}

function Sections({
  d,
  rows,
  byId,
  range,
  todayDate,
  budget,
  onPick,
}: {
  d: Decisions;
  rows: AnalyticsRow[];
  byId: Map<string, Category>;
  range: number;
  todayDate: string;
  budget: number | null;
  onPick: (month: string) => void;
}) {
  const money = useMoney();
  const all = useMemo(() => [...d.history, d.current], [d]);
  const months = useMemo(() => all.map((m) => m.month), [all]);

  const extra = useMemo(() => {
    const daily = dailyExpenses(rows);
    const win = analyticsWindow(d.month, range, todayDate);
    const averages = weekdayAverages(daily, win.dates);
    const monthDates = win.dates.filter((x) => x.startsWith(d.month));
    return {
      daily,
      averages,
      headline: weekdayHeadline(averages),
      stats: dayStats(daily, monthDates),
      counted: monthDates.length,
      flow: moneyFlow(rows, d.month),
      curve: spendCurve(daily, d.month, todayDate),
      share: categoryShare(rows, months),
    };
  }, [rows, d.month, range, todayDate, months]);

  const spend = useMemo<MonthRow[]>(() => {
    const muted = fade(c.text, 0.55);
    const faint = fade(c.text, 0.22);
    return all.map((m: MonthTotals) => {
      const now = m.month === d.month;
      return {
        month: m.month,
        current: now,
        parts: [
          { value: m.fixed, color: faint },
          { value: m.flexible, color: now ? c.accent : muted },
        ],
        ghost: now && d.running ? d.spending.projected.mid : undefined,
        label: compactMoney(m.spent),
      };
    });
  }, [all, d]);

  const jars = useMemo<Jar[]>(
    () =>
      all.map((m) => ({
        month: m.month,
        invested: m.invested,
        rate: m.income > 0 ? m.invested / m.income : null,
        current: m.month === d.month,
      })),
    [all, d.month],
  );

  const hero = heroStats(
    {
      d,
      flow: extra.flow,
      budget,
      spentDays: extra.stats.spentDays,
      counted: extra.counted,
    },
    money,
    compactMoney,
  );
  const [flowText, flowTone] = moneyFlowTakeaway(extra.flow, compactMoney);
  const [spendText, spendTone] = spendingTakeaway(d, compactMoney);
  const [investText, investTone] = investingTakeaway(d, compactMoney);
  const shareTotal = extra.share.reduce((t, r) => t + r.amount, 0);
  const topShare = extra.share[0];
  const usualMonth = d.confidence !== "none" ? d.spending.usualMonth : null;
  const curveEnd = extra.curve.current.at(-1) ?? 0;

  return (
    <>
      {d.logging.thin && (
        <View
          style={{
            flexDirection: "row",
            gap: 10,
            borderWidth: 2,
            borderColor: fade(c.warning, 0.4),
            borderRadius: 12,
            padding: 12,
          }}
        >
          <T variant="small">
            Entries on only {d.logging.loggedDays} of {d.elapsed} days this month. If some spending
            is missing, these charts look better than things are.
          </T>
        </View>
      )}

      <HeroStats stats={hero} />

      {(extra.flow.income > 0 || extra.flow.spent > 0) && (
        <Reveal>
          <ChartSection title="Where the money went" headline={flowText} tone={flowTone}>
            <MoneyFlow flow={extra.flow} byId={byId} />
          </ChartSection>
        </Reveal>
      )}

      {extra.curve.elapsed > 0 && (
        <Reveal>
          <ChartSection
            title="Spend curve"
            note="Running total"
            headline={`${money(curveEnd)} spent${d.running ? " so far" : ""}.`}
          >
            <SpendCurve curve={extra.curve} budget={budget} />
          </ChartSection>
        </Reveal>
      )}

      <Reveal>
        <ChartSection title="Spending by month" headline={spendText} tone={spendTone}>
          <MonthRows rows={spend} band={usualMonth} limit={budget} onPick={onPick} />
        </ChartSection>
      </Reveal>

      <Reveal>
        <ChartSection title="Investing" headline={investText} tone={investTone}>
          <View style={{ gap: 18 }}>
            {d.investing.rate !== null && (
              <View style={{ alignItems: "center" }}>
                <RateGauge
                  rate={d.investing.rate}
                  usual={d.investing.usualRate ? d.investing.usualRate : null}
                />
                {d.investing.usualRate !== null && (
                  <T variant="caption" color={c.textMuted}>
                    usually {pct(d.investing.usualRate)}
                  </T>
                )}
              </View>
            )}
            <InvestJars jars={jars} onPick={onPick} />
            <T variant="caption" color={c.textMuted}>
              Each jar is a month, filled to what you invested. Under it: share of income.
            </T>
          </View>
        </ChartSection>
      </Reveal>

      {extra.share.length > 1 && topShare && (
        <Reveal>
          <ChartSection
            title="Where spending usually goes"
            note={`Last ${months.length} ${months.length === 1 ? "month" : "months"}`}
            headline={`${topShare.key === OTHER ? "The rest" : (byId.get(topShare.key)?.name ?? "A category")} takes ${pct(topShare.amount / shareTotal)}`}
          >
            <CategoryDonut share={extra.share} byId={byId} />
          </ChartSection>
        </Reveal>
      )}

      <Reveal>
        <ChartSection
          title="Daily rhythm"
          headline={`Spent on ${extra.stats.spentDays} of ${extra.counted} days`}
        >
          <View style={{ gap: 28 }}>
            <CalendarHeat month={d.month} daily={extra.daily} todayDate={todayDate} />
            <View style={{ gap: 10 }}>
              <T variant="body">
                {extra.headline ?? "Average spend by weekday"}
                {"\n"}
                <T variant="caption" color={c.textMuted}>
                  Average per day, last {range} months
                </T>
              </T>
              <WeekdayBars averages={extra.averages} />
            </View>
          </View>
        </ChartSection>
      </Reveal>
    </>
  );
}
