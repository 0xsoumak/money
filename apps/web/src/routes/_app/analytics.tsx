import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsRow,
  addDays,
  addMonths,
  analyticsWindow,
  biggestShift,
  categoryMix,
  dailyExpenses,
  dayStats,
  moneyFlow,
  monthTitle,
  movers,
  repeatSpends,
  savingsRates,
  sizeStats,
  spendCurve,
  today,
  weekdayAverages,
  weekendRatio,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryRiver } from "../../components/analytics/CategoryRiver";
import { ChartSection, seriesOf, shortDate, shortMonth } from "../../components/analytics/frame";
import { MoneyFlow } from "../../components/analytics/MoneyFlow";
import { Movers } from "../../components/analytics/Movers";
import { RepeatSpends } from "../../components/analytics/RepeatSpends";
import { SavingsRate } from "../../components/analytics/SavingsRate";
import { SizeSwarm } from "../../components/analytics/SizeSwarm";
import { SpendCurve } from "../../components/analytics/SpendCurve";
import { WeekdayBars } from "../../components/analytics/WeekdayBars";
import { YearHeatmap } from "../../components/analytics/YearHeatmap";
import { type Stat, StatStrip } from "../../components/Charts";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { Button, cx, EmptyState, Label, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { analyticsQuery, type Category, categoriesQuery, summaryQuery } from "../../lib/queries";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

/** How far back the transaction-size chart looks; a year of dots would be a smear. */
const SWARM_DAYS = 90;

const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Everything the page shows, computed once per data/month/range change. */
function compute(rows: AnalyticsRow[], month: string, range: AnalyticsRange, todayDate: string) {
  const win = analyticsWindow(month, range, todayDate);
  const first = win.dates[0] ?? `${month}-01`;
  const last = win.dates.at(-1) ?? first;
  const inWindow = rows.filter((r) => r.date >= first && r.date <= last);
  const daily = dailyExpenses(rows);
  const mix = categoryMix(rows, win.fullMonths);
  const savings = savingsRates(rows, win.fullMonths);
  const swarmFrom = addDays(last, -(SWARM_DAYS - 1));
  const swarm = inWindow.filter((r) => r.type === "expense" && r.date >= swarmFrom);

  const activeMonths = mix.months.filter((m) => m.total > 0);
  const income = savings.reduce((t, s) => t + s.income, 0);
  const invested = savings.reduce((t, s) => t + s.invested, 0);

  return {
    win,
    daily,
    flow: moneyFlow(rows, month),
    curve: spendCurve(daily, month, todayDate),
    movers: movers(rows, month, todayDate),
    days: dayStats(daily, win.dates),
    weekdays: weekdayAverages(daily, win.dates),
    mix,
    shift: biggestShift(mix),
    savings,
    swarm,
    size: sizeStats(swarm.map((r) => r.amount)),
    repeats: repeatSpends(inWindow),
    avgMonth: activeMonths.length
      ? activeMonths.reduce((t, m) => t + m.total, 0) / activeMonths.length
      : 0,
    savedRate: income > 0 ? invested / income : null,
  };
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
  const a = useMemo(
    () => (q.data ? compute(q.data.rows, month, range, todayDate) : null),
    [q.data, month, range, todayDate],
  );

  const budget = summary.data?.budget.overall ?? null;
  const running = todayDate.startsWith(month);
  const prev = addMonths(month, -1);
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
          {a ? <StatStrip stats={kpis(a, money)} /> : <Skeleton className="h-[118px]" />}
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
          a && (
            <>
              <Reveal>
                <ChartSection
                  title={`Where ${monthTitle(month).split(" ")[0]}'s money went`}
                  note="Income → what happened to it"
                  headline={flowHeadline(a.flow, money)}
                >
                  <MoneyFlow flow={a.flow} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection
                  title="Spend curve"
                  note="Running total"
                  headline={curveHeadline(a.curve, running, money)}
                >
                  <SpendCurve curve={a.curve} budget={budget} />
                </ChartSection>
                <ChartSection
                  title="Movers"
                  note={
                    running
                      ? `Days 1–${a.curve.elapsed}, ${shortMonth(prev)} vs ${shortMonth(month)}`
                      : `${shortMonth(prev)} vs ${shortMonth(month)}`
                  }
                  headline={moversHeadline(a.movers, byId, money)}
                >
                  <Movers
                    movers={a.movers}
                    byId={byId}
                    labels={[shortMonth(prev), shortMonth(month)]}
                  />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title={`Every day, last ${range} months`}
                  headline={`${a.days.noSpendDays} no-spend ${a.days.noSpendDays === 1 ? "day" : "days"}. Longest streak: ${a.days.longestNoSpend} ${a.days.longestNoSpend === 1 ? "day" : "days"}.`}
                >
                  <YearHeatmap dates={a.win.dates} daily={a.daily} todayDate={todayDate} />
                </ChartSection>
              </Reveal>

              <Reveal>
                <ChartSection
                  title="How the mix changed"
                  note={`${a.mix.months.length} full months · band width = amount`}
                  headline={riverHeadline(a.shift, byId)}
                >
                  <CategoryRiver mix={a.mix} byId={byId} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection
                  title="Weekday rhythm"
                  note="Average per day"
                  headline={weekdayHeadline(a.weekdays)}
                >
                  <WeekdayBars averages={a.weekdays} />
                </ChartSection>
                <ChartSection
                  title="Savings rate"
                  note="Invested ÷ income"
                  headline={savingsHeadline(a.savings)}
                >
                  <SavingsRate months={a.savings} />
                </ChartSection>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-14 lg:grid-cols-2">
                <ChartSection
                  title="Transaction sizes"
                  note={`Every expense, last ${Math.min(SWARM_DAYS, a.win.dates.length)} days`}
                  headline={
                    a.size &&
                    (a.size.topCount === 1
                      ? `Your biggest buy was ${pct(a.size.topShare)} of spending.`
                      : `Your biggest ${a.size.topCount} buys were ${pct(a.size.topShare)} of spending.`)
                  }
                >
                  <SizeSwarm items={a.swarm} median={a.size?.median ?? 0} byId={byId} />
                </ChartSection>
                <ChartSection
                  title="Repeat spends"
                  note="Same note, this range"
                  headline={repeatHeadline(a.repeats, money)}
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

// ── Headlines: one sentence that says what each chart shows ─────────────────

type Computed = ReturnType<typeof compute>;
type Money = (minor: number) => string;

function kpis(a: Computed, money: Money): Stat[] {
  return [
    {
      label: "Avg month",
      value: money(Math.round(a.avgMonth / 100) * 100),
      hint: "spending, full months",
    },
    {
      label: "Saved",
      value: a.savedRate === null ? "–" : pct(a.savedRate),
      hint: "of income, invested",
      tone: a.savedRate !== null && a.savedRate > 0 ? "accent" : undefined,
    },
    {
      label: "No-spend days",
      value: String(a.days.noSpendDays),
      hint: `out of ${a.win.dates.length}`,
    },
    {
      label: "Biggest day",
      value: money(a.days.peak?.total ?? 0),
      hint: a.days.peak ? shortDate(a.days.peak.date) : "–",
    },
  ];
}

function flowHeadline(f: Computed["flow"], money: Money) {
  if (f.shortfall > 0) return `You spent and invested ${money(f.shortfall)} more than came in.`;
  if (f.income === 0) return f.spent > 0 ? `${money(f.spent)} spent, no income logged.` : null;
  return (
    <>
      You kept <span className="text-accent">{pct(f.kept / f.income)}</span> of what came in.
    </>
  );
}

function curveHeadline(c: Computed["curve"], running: boolean, money: Money) {
  const now = c.current.at(-1) ?? 0;
  if (c.elapsed === 0) return null;
  if (c.previousAtSamePoint === 0) return `${money(now)} spent so far.`;
  const diff = c.previousAtSamePoint - now;
  const when = running ? "this point last month" : "the month before";
  return diff >= 0 ? `${money(diff)} less than ${when}.` : `${money(-diff)} more than ${when}.`;
}

function moversHeadline(list: Computed["movers"], byId: Map<string, Category>, money: Money) {
  const up = list.filter((m) => m.change > 0).sort((a, b) => b.change - a.change)[0];
  const down = list.filter((m) => m.change < 0).sort((a, b) => a.change - b.change)[0];
  const name = (id: string) => seriesOf(id, byId).name;
  const parts = [
    up && `${name(up.categoryId)} up ${money(up.change)}`,
    down && `${name(down.categoryId)} down ${money(-down.change)}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join(", ")}.` : null;
}

function riverHeadline(shift: Computed["shift"], byId: Map<string, Category>) {
  if (!shift) return null;
  if (Math.abs(shift.to - shift.from) < 0.03) return "Your spending mix held steady.";
  return `${seriesOf(shift.key, byId).name} went from ${pct(shift.from)} to ${pct(shift.to)} of your spending.`;
}

function weekdayHeadline(averages: number[]) {
  const r = weekendRatio(averages);
  if (r === null) return null;
  if (r >= 1.15) return `Weekends cost ${r.toFixed(1).replace(/\.0$/, "")}× a weekday.`;
  if (r <= 0.87) return "Weekdays cost you more than weekends.";
  return "Spending is even across the week.";
}

function savingsHeadline(months: Computed["savings"]) {
  const pts = months.filter((m) => m.rate !== null) as (Computed["savings"][number] & {
    rate: number;
  })[];
  const first = pts[0];
  const last = pts.at(-1);
  if (!first || !last) return null;
  if (pts.length === 1) return `${pct(last.rate)} of income invested.`;
  const best = pts.reduce((a, b) => (b.rate > a.rate ? b : a));
  const dir = last.rate >= first.rate ? "Up" : "Down";
  return `${dir} from ${pct(first.rate)} to ${pct(last.rate)}. Best: ${shortMonth(best.month)}, ${pct(best.rate)}.`;
}

function repeatHeadline(items: Computed["repeats"], money: Money) {
  const monthly = items.filter((r) => r.monthly);
  if (monthly.length)
    return `Fixed monthly costs: ${money(monthly.reduce((t, r) => t + r.latest, 0))}.`;
  const top = items[0];
  return top ? `${top.note}: ${top.count} times, ${money(top.total)}.` : null;
}
