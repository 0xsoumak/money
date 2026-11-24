import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsRow,
  addMonths,
  analyticsWindow,
  categoryRanks,
  type DayStats,
  type Decisions,
  dailyExpenses,
  dayStats,
  decisions,
  eachDay,
  isNotable,
  lastDayOf,
  type MoneyFlow as MoneyFlowData,
  type MonthTotals,
  moneyFlow,
  type Ranked,
  spendingSplit,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CashflowTable } from "../../components/analytics/CashflowTable";
import { Dumbbell, type DumbbellRow } from "../../components/charts/Dumbbell";
import {
  CategoryBump,
  ExpenseBubbles,
  RateGauge,
  SpendTreemap,
  YearCalendar,
} from "../../components/charts/Explore";
import { alpha, C } from "../../components/charts/echarts";
import { compactMoney, Key, Legend, Panel, type Tone } from "../../components/charts/kit";
import { MoneyFlow } from "../../components/charts/MoneyFlow";
import { type Column, MonthColumns } from "../../components/charts/MonthColumns";
import { CalendarHeat, WeekdayBars } from "../../components/charts/Rhythm";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { Button, cx, EmptyState, Label, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { analyticsQuery, type Category, categoriesQuery, summaryQuery } from "../../lib/queries";

export const Route = createFileRoute("/_app/analytics")({
  component: Analytics,
});

type Money = (minor: number) => string;
type Takeaway = [text: string, tone: Tone];
const pct = (r: number) => `${Math.round(r * 100)}%`;

// ── Takeaways: a few words above each chart ─────────────────────────────────

function moneyFlowTakeaway(f: MoneyFlowData): Takeaway {
  if (f.income === 0) return [`${compactMoney(f.spent)} spent, no income logged`, "info"];
  if (f.shortfall > 0) return [`${compactMoney(f.shortfall)} came from savings`, "warn"];
  if (f.kept > 0) return [`You kept ${pct(f.kept / f.income)} of what came in`, "good"];
  return ["Everything that came in went out", "info"];
}

function spendingTakeaway(d: Decisions): Takeaway {
  const u = d.spending.usualByNow;
  if (!u) return [`${compactMoney(d.current.spent)} spent${d.running ? " so far" : ""}`, "info"];
  const by = d.running ? " by now" : "";
  switch (d.spending.verdict) {
    case "above":
      return [`${compactMoney(d.current.flexible - u.high)} above usual${by}`, "warn"];
    case "below":
      // Never praise spending when logging is thin: missing entries look like saving.
      return [
        `${compactMoney(u.low - d.current.flexible)} below usual${by}`,
        d.logging.thin ? "info" : "good",
      ];
    default:
      return [`Within your usual range${by}`, "info"];
  }
}

function changesTakeaway(d: Decisions, byId: Map<string, Category>): Takeaway {
  const m = d.spending.movers[0];
  if (!m) return ["No big changes", "info"];
  const name = byId.get(m.key)?.name ?? "A category";
  return m.diff > 0
    ? [`${name} up ${compactMoney(m.diff)}`, "warn"]
    : [`${name} down ${compactMoney(-m.diff)}`, d.logging.thin ? "info" : "good"];
}

function cashflowTakeaway(all: MonthTotals[]): Takeaway {
  const rows = all.filter((r) => r.income > 0);
  if (rows.length === 0) return ["Log income to see what's left", "info"];
  const short = rows.filter((r) => r.left < 0).length;
  if (short > 0) return [`Spent more than you earned in ${short} of ${rows.length}`, "warn"];
  return [rows.length > 1 ? `Within income all ${rows.length} months` : "Within income", "good"];
}

function investingTakeaway(d: Decisions): Takeaway {
  const { rate } = d.investing;
  const c = d.consistency;
  const head =
    rate !== null ? `${pct(rate)} of income` : `${compactMoney(d.current.invested)} invested`;
  const regular =
    c.steadiness === "early" ? "" : ` · ${c.investedMonths} of ${c.months.length} months`;
  const tone: Tone =
    c.steadiness === "steady"
      ? "good"
      : c.steadiness === "irregular" || c.steadiness === "none"
        ? "warn"
        : "info";
  return [head + regular, tone];
}

// ── Page ────────────────────────────────────────────────────────────────────

function Analytics() {
  const { month, setMonth } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const [range, setRange] = useState<AnalyticsRange>(6);
  const todayDate = today();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const q = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const byId = useMemo(
    () => new Map<string, Category>(categories.map((c) => [c.id, c])),
    [categories],
  );
  const fixedIds = useMemo(
    () => new Set(categories.filter((c) => c.fixed).map((c) => c.id)),
    [categories],
  );

  const budgets = summary.data?.budget;
  const d = useMemo(
    () =>
      q.data
        ? decisions({
            rows: q.data.rows,
            // While the next month loads, keep computing for the month the rows belong to.
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

  const rows = q.data?.rows;
  const dataMonth = q.data?.to;
  const extra = useMemo(() => {
    if (!rows || !dataMonth) return null;
    const daily = dailyExpenses(rows);
    const win = analyticsWindow(dataMonth, range, todayDate);
    const averages = weekdayAverages(daily, win.dates);
    const monthDates = win.dates.filter((x) => x.startsWith(dataMonth));
    const yearFrom = `${addMonths(dataMonth, -11)}-01`;
    const yearTo = todayDate < lastDayOf(dataMonth) ? todayDate : lastDayOf(dataMonth);
    return {
      daily,
      averages,
      headline: weekdayHeadline(averages),
      stats: dayStats(daily, monthDates),
      counted: monthDates.length,
      flow: moneyFlow(rows, dataMonth),
      split: spendingSplit(rows, dataMonth, fixedIds),
      year: { from: yearFrom, to: yearTo, stats: dayStats(daily, eachDay(yearFrom, yearTo)) },
    };
  }, [rows, dataMonth, range, todayDate, fixedIds]);

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      <div
        aria-busy={q.isPlaceholderData}
        className={cx(
          "flex flex-col gap-5 transition-opacity duration-300",
          q.isPlaceholderData && "pointer-events-none opacity-35",
        )}
      >
        <header className="mb-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <Label>
              {d
                ? d.confidence === "none"
                  ? "This month only"
                  : `Compared with your last ${d.history.length} ${d.history.length === 1 ? "month" : "months"}`
                : " "}
            </Label>
            <h1 className="mt-2 text-[56px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[80px]">
              Analytics
            </h1>
          </div>
          <fieldset className="flex items-center gap-2">
            <legend className="sr-only">Compare with the last</legend>
            <span className="text-sm text-muted">Compare with</span>
            <span className="flex gap-[3px] rounded-[10px] border-2 border-line p-[3px]">
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
            </span>
          </fieldset>
        </header>

        {q.isPending ? (
          <>
            <Skeleton className="h-[400px]" />
            <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
              <Skeleton className="h-[380px]" />
              <Skeleton className="h-[380px]" />
            </div>
          </>
        ) : q.data?.rows.length === 0 ? (
          <EmptyState
            title="Nothing to analyse yet"
            hint="This page fills in as you log expenses, income and investments."
            action={<Button onClick={() => openNew()}>Add expense</Button>}
          />
        ) : (
          d &&
          extra &&
          rows && (
            <Sections
              d={d}
              rows={rows}
              byId={byId}
              money={money}
              extra={extra}
              todayDate={todayDate}
              range={range}
              onPick={setMonth}
            />
          )
        )}
      </div>
    </div>
  );
}

interface Extra {
  daily: Map<string, number>;
  averages: number[];
  headline: string | null;
  stats: DayStats;
  counted: number;
  flow: MoneyFlowData;
  split: { fixed: Ranked[]; flexible: Ranked[] };
  year: { from: string; to: string; stats: DayStats };
}

function Sections({
  d,
  rows,
  byId,
  money,
  extra,
  todayDate,
  range,
  onPick,
}: {
  d: Decisions;
  rows: AnalyticsRow[];
  byId: Map<string, Category>;
  money: Money;
  extra: Extra;
  todayDate: string;
  range: number;
  onPick: (month: string) => void;
}) {
  const all = useMemo(() => [...d.history, d.current], [d]);
  const months = useMemo(() => all.map((m) => m.month), [all]);
  const ranks = useMemo(() => categoryRanks(rows, months, 6), [rows, months]);
  const missed = useMemo(
    () => new Set(d.consistency.months.filter((m) => m.invested === 0).map((m) => m.month)),
    [d],
  );
  const catName = (id: string) => byId.get(id)?.name ?? "A category";

  const cols = useMemo(() => {
    const isNow = (m: MonthTotals) => m.month === d.month;
    const soFar = (m: MonthTotals) => (isNow(m) && d.running ? " so far" : "");
    const muted = alpha(C.text, 0.55);
    const faint = alpha(C.text, 0.2);
    const spentGrey = alpha(C.text, 0.42);

    // Spending, month by month: fixed under flexible, this month in lime.
    const spend: Column[] = all.map((m) => {
      const now = isNow(m);
      const likely = now && d.running ? d.spending.projected.mid : undefined;
      return {
        month: m.month,
        current: now,
        parts: [
          { value: m.fixed, color: faint },
          { value: m.flexible, color: now ? C.accent : muted },
        ],
        ghost: likely,
        label: now ? compactMoney(m.spent) : undefined,
        tip: [
          { color: C.text, value: money(m.spent), name: `spent${soFar(m)}` },
          ...(d.hasFixed
            ? [
                { color: now ? C.accent : muted, value: money(m.flexible), name: "flexible" },
                { color: faint, value: money(m.fixed), name: "fixed" },
              ]
            : []),
          ...(likely !== undefined && likely > m.spent
            ? [{ color: alpha(C.text, 0.3), value: money(likely), name: "likely by month end" }]
            : []),
        ],
      };
    });

    // Income vs outgoings: spent and invested stacked under an income marker.
    const flow: Column[] = all.map((m) => ({
      month: m.month,
      current: isNow(m),
      parts: [
        { value: m.spent, color: spentGrey },
        { value: m.invested, color: C.accent },
      ],
      marker: m.income,
      sub:
        m.income > 0
          ? {
              text: `${m.left < 0 ? "" : "+"}${compactMoney(m.left)}`,
              tone: m.left < 0 ? ("danger" as const) : undefined,
            }
          : { text: "–" },
      tip: [
        { color: C.text, value: money(m.income), name: "earned" },
        { color: spentGrey, value: money(m.spent), name: "spent" },
        { color: C.accent, value: money(m.invested), name: "invested" },
        {
          value: `${m.left < 0 ? "−" : ""}${money(Math.abs(m.left))}`,
          name: m.left < 0 ? "short" : "left",
          tone: m.left < 0 ? ("danger" as const) : undefined,
        },
      ],
    }));

    // Investing: lime columns, a dashed slot for a missed month.
    const invest: Column[] = all.map((m) => {
      const rate = m.income > 0 ? m.invested / m.income : null;
      return {
        month: m.month,
        current: isNow(m),
        parts: [{ value: m.invested, color: C.accent }],
        missing: missed.has(m.month),
        label: isNow(m) && m.invested > 0 ? compactMoney(m.invested) : undefined,
        sub: { text: rate !== null ? pct(rate) : "–" },
        tip: [
          {
            color: C.accent,
            value: m.invested > 0 ? money(m.invested) : "Nothing",
            name: `invested${soFar(m)}`,
          },
          ...(rate !== null ? [{ value: pct(rate), name: "of income" }] : []),
        ],
      };
    });
    return { spend, flow, invest };
  }, [all, d, missed, money]);

  const usualMonth = d.confidence !== "none" ? d.spending.usualMonth : null;
  const limitValue = d.budget.overall?.limit;
  const limit = useMemo(
    () => (limitValue ? { value: limitValue, label: `Budget ${compactMoney(limitValue)}` } : null),
    [limitValue],
  );
  const usualInvest = d.confidence !== "none" ? d.investing.usual : null;

  const dumbbell: DumbbellRow[] = d.spending.byCategory.map((m) => {
    const c = byId.get(m.key);
    return {
      key: m.key,
      name: c?.name ?? "Unknown",
      emoji: c?.emoji ?? "?",
      color: c?.color ?? "slate",
      now: m.now,
      usual: m.usual,
      notable: isNotable(m),
    };
  });

  const [flowText, flowTone] = moneyFlowTakeaway(extra.flow);
  const [spendText, spendTone] = spendingTakeaway(d);
  const [changeText, changeTone] = changesTakeaway(d, byId);
  const [cashText, cashTone] = cashflowTakeaway(all);
  const [investText, investTone] = investingTakeaway(d);

  const monthExpenses = rows.filter((r) => r.type === "expense" && r.date.startsWith(d.month));
  const biggest = monthExpenses.reduce<AnalyticsRow | null>(
    (b, r) => (!b || r.amount > b.amount ? r : b),
    null,
  );
  const byAmount = [...extra.split.fixed, ...extra.split.flexible].sort(
    (a, b) => b.amount - a.amount,
  );
  const spentTotal = byAmount.reduce((t, r) => t + r.amount, 0);
  const topCat = byAmount[0];
  const leader = ranks.find((r) => r.ranks.at(-1) === 1);
  const prevLeader = ranks.find((r) => r.ranks.at(-2) === 1);
  const { stats, year } = extra;

  return (
    <>
      {d.logging.thin && (
        <p className="flex items-start gap-3 rounded-xl border-2 border-warning/40 px-4 py-3 text-[15px]">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-warning" />
          <span>
            Entries on only {d.logging.loggedDays} of {d.elapsed} days this month. If some spending
            is missing, these charts look better than things are.
          </span>
        </p>
      )}

      {(extra.flow.income > 0 || extra.flow.spent > 0) && (
        <Reveal>
          <Panel id="flow" title="Where the money went" takeaway={flowText} tone={flowTone}>
            <MoneyFlow flow={extra.flow} byId={byId} />
          </Panel>
        </Reveal>
      )}

      <Reveal className={cx("grid gap-5", dumbbell.length > 0 && "lg:grid-cols-[3fr_2fr]")}>
        <Panel id="spending" title="Spending by month" takeaway={spendText} tone={spendTone}>
          <MonthColumns
            columns={cols.spend}
            band={usualMonth}
            limit={limit}
            label={`Spending by month. ${spendText}.`}
            onPick={onPick}
          />
          <Legend>
            {d.hasFixed && (
              <>
                <Key className="bg-ink/55">Flexible</Key>
                <Key className="bg-ink/20">Fixed</Key>
              </>
            )}
            <Key className="bg-accent">This month</Key>
            {usualMonth && (
              <Key shape="band" className="bg-ink/15">
                Usual month
              </Key>
            )}
            {d.running && (
              <Key shape="ring" className="rounded-[3px] border-dashed border-line-strong/45">
                Likely
              </Key>
            )}
            {limit && (
              <Key shape="line" className="bg-ink/60">
                Budget
              </Key>
            )}
          </Legend>
          {!d.hasFixed && (
            <p className="text-sm text-muted">
              Rent, EMIs or family support in here?{" "}
              <Link to="/categories" className="font-semibold text-ink underline">
                Mark them as fixed
              </Link>{" "}
              so they don't count as overspending.
            </p>
          )}
        </Panel>

        {dumbbell.length > 0 && (
          <Panel id="changes" title="What changed" takeaway={changeText} tone={changeTone}>
            <Dumbbell rows={dumbbell} running={d.running} />
          </Panel>
        )}
      </Reveal>

      {monthExpenses.length > 0 && (
        <Reveal className="grid gap-5 lg:grid-cols-[3fr_2fr]">
          <Panel
            id="expenses"
            title="Every expense"
            takeaway={
              biggest
                ? `Biggest: ${compactMoney(biggest.amount)} on ${catName(biggest.categoryId)}`
                : undefined
            }
          >
            <ExpenseBubbles rows={rows} month={d.month} byId={byId} />
          </Panel>
          <Panel
            id="categories"
            title="Spending by category"
            takeaway={
              topCat && spentTotal > 0
                ? `${catName(topCat.key)} is ${pct(topCat.amount / spentTotal)} of it`
                : undefined
            }
          >
            <SpendTreemap split={extra.split} byId={byId} />
          </Panel>
        </Reveal>
      )}

      <Reveal>
        <Panel id="cashflow" title="Income vs outgoings" takeaway={cashText} tone={cashTone}>
          <MonthColumns
            columns={cols.flow}
            label={`Income against spending and investing by month. ${cashText}.`}
            onPick={onPick}
          />
          <Legend>
            <Key shape="line" className="h-[3px] bg-ink">
              Earned
            </Key>
            <Key className="bg-ink/45">Spent</Key>
            <Key className="bg-accent">Invested</Key>
            <span>Under each month: what was left</span>
          </Legend>
          <CashflowTable rows={all} running={d.running} />
        </Panel>
      </Reveal>

      <Reveal className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Panel id="investing" title="Investing" takeaway={investText} tone={investTone}>
          <div
            className={cx(
              "grid items-center gap-4",
              d.investing.rate !== null && "sm:grid-cols-[180px_1fr]",
            )}
          >
            {d.investing.rate !== null && (
              <div className="flex flex-col items-center">
                <RateGauge rate={d.investing.rate} usual={d.investing.usualRate} />
                {d.investing.usualRate !== null && (
                  <span className="-mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted">
                    <span aria-hidden="true" className="inline-block h-3 w-[3px] rounded bg-ink" />
                    usually {pct(d.investing.usualRate)}
                  </span>
                )}
              </div>
            )}
            <MonthColumns
              columns={cols.invest}
              band={usualInvest}
              height={220}
              label={`Invested by month. ${investText}.`}
              onPick={onPick}
            />
          </div>
          <Legend>
            <Key className="bg-accent">Invested</Key>
            {usualInvest && (
              <Key shape="band" className="bg-ink/15">
                Usual month
              </Key>
            )}
            {missed.size > 0 && (
              <Key shape="ring" className="rounded-[3px] border-dashed border-line-strong/40">
                Missed
              </Key>
            )}
            <span>Under each month: share of income</span>
          </Legend>
        </Panel>

        <Panel
          id="rhythm"
          title="Daily rhythm"
          takeaway={`Spent on ${stats.spentDays} of ${extra.counted} days`}
        >
          <CalendarHeat month={d.month} daily={extra.daily} todayDate={todayDate} />
          <div className="flex flex-col gap-3 border-t-2 border-line pt-5">
            <p className="text-[15px] font-semibold">
              {extra.headline ?? "Average spend by weekday"}
              <span className="block text-[13px] font-normal text-muted">
                Average per day, last {range} months
              </span>
            </p>
            <WeekdayBars averages={extra.averages} />
          </div>
        </Panel>
      </Reveal>

      <Reveal>
        <Panel
          id="year"
          title="Your year, day by day"
          takeaway={`Longest break from spending: ${year.stats.longestNoSpend} ${year.stats.longestNoSpend === 1 ? "day" : "days"}`}
        >
          <YearCalendar daily={extra.daily} from={year.from} to={year.to} />
          <Legend>
            <span className="inline-flex items-center gap-1.5">
              Less
              <span className="size-3 rounded-[3px] bg-surface" />
              <span className="size-3 rounded-[3px] bg-accent/20" />
              <span className="size-3 rounded-[3px] bg-accent/40" />
              <span className="size-3 rounded-[3px] bg-accent/70" />
              <span className="size-3 rounded-[3px] bg-accent" />
              More
            </span>
            <span>
              Spent on {year.stats.spentDays} of {year.stats.spentDays + year.stats.noSpendDays}{" "}
              days
            </span>
          </Legend>
        </Panel>
      </Reveal>

      {ranks.length > 1 && months.length > 1 && (
        <Reveal>
          <Panel
            id="ranking"
            title="Category ranking"
            takeaway={
              leader
                ? prevLeader && prevLeader.key !== leader.key
                  ? `${catName(leader.key)} took the top spot`
                  : `${catName(leader.key)} stays on top`
                : undefined
            }
          >
            <CategoryBump ranks={ranks} months={months} byId={byId} />
          </Panel>
        </Reveal>
      )}
    </>
  );
}
