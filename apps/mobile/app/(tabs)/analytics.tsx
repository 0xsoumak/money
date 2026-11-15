import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  addMonths,
  analyticsHeadlines,
  analyticsKpis,
  analyticsReport,
  type HeadlinePart,
  monthTitle,
  shortDate,
  shortMonth,
  today,
} from "@money/shared";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";
import { CategoryRiver } from "../../components/analytics/CategoryRiver";
import { ChartSection, seriesOf } from "../../components/analytics/frame";
import { MoneyFlow } from "../../components/analytics/MoneyFlow";
import { Movers } from "../../components/analytics/Movers";
import { RepeatSpends } from "../../components/analytics/RepeatSpends";
import { SavingsRate } from "../../components/analytics/SavingsRate";
import { SizeSwarm } from "../../components/analytics/SizeSwarm";
import { SpendCurve } from "../../components/analytics/SpendCurve";
import { WeekdayBars } from "../../components/analytics/WeekdayBars";
import { YearHeatmap } from "../../components/analytics/YearHeatmap";
import { StatGrid } from "../../components/Charts";
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

/** A headline whose accent parts are shown in lime. */
function headline(parts: HeadlinePart[] | null) {
  if (!parts) return null;
  return parts.map((p) =>
    p.accent ? (
      <T key={p.text} variant="title" size={21} color={c.accent}>
        {p.text}
      </T>
    ) : (
      p.text
    ),
  );
}

export default function Analytics() {
  const router = useRouter();
  const qc = useQueryClient();
  const { month } = useMonth();
  const money = useMoney();
  const [range, setRange] = useState<AnalyticsRange>(12);
  const todayDate = today();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const q = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const byId = useMemo(
    () => new Map<string, Category>(categories.map((x) => [x.id, x])),
    [categories],
  );

  // While the next month loads, the previous month's rows stay up (dimmed). Compute for the
  // month those rows belong to, so the charts never briefly read as empty.
  const dataMonth = q.data?.to ?? month;
  const a = useMemo(
    () => (q.data ? analyticsReport(q.data.rows, q.data.to, range, todayDate) : null),
    [q.data, range, todayDate],
  );
  const h = useMemo(
    () => (a ? analyticsHeadlines(a, money, (key) => seriesOf(key, byId).name) : null),
    [a, money, byId],
  );

  const budget = summary.data?.budget.overall ?? null;
  const prev = addMonths(dataMonth, -1);
  const lastDate = a?.win.dates.at(-1);

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={() => void qc.invalidateQueries({ queryKey: ["analytics"] })}
    >
      <MonthSwitcher />
      <View
        accessibilityState={{ busy: q.isPlaceholderData }}
        pointerEvents={q.isPlaceholderData ? "none" : "auto"}
        style={{ gap: 40, opacity: q.isPlaceholderData ? 0.35 : 1 }}
      >
        <View style={{ gap: 18 }}>
          <View style={{ gap: 4 }}>
            <Label>
              Last {range} months{lastDate ? ` · to ${shortDate(lastDate)}` : ""}
            </Label>
            <T variant="display" size={52} accessibilityRole="header">
              Analytics
            </T>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel="Range"
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
          {a ? <StatGrid stats={analyticsKpis(a, money)} /> : <Skeleton style={{ height: 150 }} />}
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
          a &&
          h && (
            <>
              <Reveal>
                <ChartSection
                  title={`Where ${monthTitle(dataMonth).split(" ")[0]}'s money went`}
                  headline={headline(h.flow)}
                >
                  <MoneyFlow flow={a.flow} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection title="Spend curve" note="Running total" headline={h.curve}>
                  <SpendCurve curve={a.curve} budget={budget} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title="Movers"
                  note={a.running ? `Days 1–${a.curve.elapsed}` : undefined}
                  headline={h.movers}
                >
                  <Movers
                    movers={a.movers}
                    byId={byId}
                    labels={[shortMonth(prev), shortMonth(dataMonth)]}
                  />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection title="Every day" note={`Last ${range} months`} headline={h.days}>
                  <YearHeatmap
                    dates={a.win.dates}
                    daily={a.daily}
                    todayDate={todayDate}
                    peak={a.days.peak}
                  />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title="How the mix changed"
                  note={`${a.mix.months.length} full months`}
                  headline={h.mix}
                >
                  <CategoryRiver mix={a.mix} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection title="Weekday rhythm" note="Average per day" headline={h.weekdays}>
                  <WeekdayBars averages={a.weekdays} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection title="Savings rate" note="Invested ÷ income" headline={h.savings}>
                  <SavingsRate months={a.savings} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title="Transaction sizes"
                  note={`Last ${a.swarmDays} days`}
                  headline={h.sizes}
                >
                  <SizeSwarm items={a.swarm} median={a.size?.median ?? 0} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection title="Repeat spends" note="Same note" headline={h.repeats}>
                  <RepeatSpends items={a.repeats} byId={byId} />
                </ChartSection>
              </Reveal>
            </>
          )
        )}
      </View>
    </Screen>
  );
}
