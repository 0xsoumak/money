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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { StatStrip } from "../../components/Charts";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { Button, cx, EmptyState, Label, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { analyticsQuery, type Category, categoriesQuery, summaryQuery } from "../../lib/queries";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

/** A headline whose accent parts are shown in lime. */
function Headline({ parts }: { parts: HeadlinePart[] | null }) {
  if (!parts) return null;
  return (
    <>
      {parts.map((p) =>
        p.accent ? (
          <span key={p.text} className="text-accent">
            {p.text}
          </span>
        ) : (
          p.text
        ),
      )}
    </>
  );
}

function Analytics() {
  const { month } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const [range, setRange] = useState<AnalyticsRange>(12);
  const todayDate = today();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const q = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const byId = useMemo(
    () => new Map<string, Category>(categories.map((c) => [c.id, c])),
    [categories],
  );
  // While the next month loads, the previous month's rows stay up (dimmed). Compute for the
  // month those rows belong to, not the new one, or the charts briefly show it as empty.
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
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      <div
        aria-busy={q.isPlaceholderData}
        className={cx(
          "flex flex-col gap-14 transition-opacity duration-300",
          q.isPlaceholderData && "pointer-events-none opacity-35",
        )}
      >
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Label>
                Last {range} months{lastDate ? ` · to ${shortDate(lastDate)}` : ""}
              </Label>
              <h1 className="mt-2 text-[56px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[80px] md:text-[96px]">
                Analytics
              </h1>
            </div>
            <fieldset className="flex gap-[3px] rounded-[10px] border-2 border-line p-[3px]">
              <legend className="sr-only">Range</legend>
              {ANALYTICS_RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                  className={cx(
                    "min-h-11 min-w-14 cursor-pointer rounded-[7px] px-3 text-sm font-bold transition-colors",
                    range === r ? "bg-ink text-bg" : "text-muted hover:text-ink",
                  )}
                >
                  {r}M
                </button>
              ))}
            </fieldset>
          </div>
          {a ? <StatStrip stats={analyticsKpis(a, money)} /> : <Skeleton className="h-[118px]" />}
        </section>

        {q.isPending ? (
          <Skeleton className="h-[420px]" />
        ) : q.data?.rows.length === 0 ? (
          <EmptyState
            title="Nothing to analyse yet"
            hint="Charts fill in as you log expenses, income and investments."
            action={<Button onClick={() => openNew()}>Add expense</Button>}
          />
        ) : (
          a &&
          h && (
            <>
              <Reveal>
                <ChartSection
                  title={`Where ${monthTitle(dataMonth).split(" ")[0]}'s money went`}
                  note="Income → what happened to it"
                  headline={<Headline parts={h.flow} />}
                >
                  <MoneyFlow flow={a.flow} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection title="Spend curve" note="Running total" headline={h.curve}>
                  <SpendCurve curve={a.curve} budget={budget} />
                </ChartSection>
                <ChartSection
                  title="Movers"
                  note={
                    a.running
                      ? `Days 1–${a.curve.elapsed}, ${shortMonth(prev)} vs ${shortMonth(dataMonth)}`
                      : `${shortMonth(prev)} vs ${shortMonth(dataMonth)}`
                  }
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
                <ChartSection title={`Every day, last ${range} months`} headline={h.days}>
                  <YearHeatmap dates={a.win.dates} daily={a.daily} todayDate={todayDate} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title="How the mix changed"
                  note={`${a.mix.months.length} full months · band width = amount`}
                  headline={h.mix}
                >
                  <CategoryRiver mix={a.mix} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection title="Weekday rhythm" note="Average per day" headline={h.weekdays}>
                  <WeekdayBars averages={a.weekdays} />
                </ChartSection>
                <ChartSection title="Savings rate" note="Invested ÷ income" headline={h.savings}>
                  <SavingsRate months={a.savings} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection
                  title="Transaction sizes"
                  note={`Every expense, last ${a.swarmDays} days`}
                  headline={h.sizes}
                >
                  <SizeSwarm items={a.swarm} median={a.size?.median ?? 0} byId={byId} />
                </ChartSection>
                <ChartSection
                  title="Repeat spends"
                  note="Same note, this range"
                  headline={h.repeats}
                >
                  <RepeatSpends items={a.repeats} byId={byId} />
                </ChartSection>
              </Reveal>
            </>
          )
        )}
      </div>
    </div>
  );
}
