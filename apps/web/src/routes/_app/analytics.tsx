import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type AnalyticsRow,
  analyticsWindow,
  categoryShare,
  type DayStats,
  type Decisions,
  dailyExpenses,
  dayStats,
  decisions,
  type MoneyFlow as MoneyFlowData,
  type MonthTotals,
  moneyFlow,
  OTHER,
  type SpendCurve as SpendCurveData,
  spendCurve,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryDonut, RateGauge } from "../../components/charts/Explore";
import { alpha, C } from "../../components/charts/echarts";
import { InvestJars, type Jar } from "../../components/charts/InvestJars";
import { compactMoney, Key, Legend, Panel, type Tone } from "../../components/charts/kit";
import { MoneyFlow } from "../../components/charts/MoneyFlow";
import { type MonthRow, MonthRows } from "../../components/charts/MonthRows";
import { CalendarHeat, WeekdayBars } from "../../components/charts/Rhythm";
import { SpendCurve } from "../../components/charts/SpendCurve";
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
    return {
      daily,
      averages,
      headline: weekdayHeadline(averages),
      stats: dayStats(daily, monthDates),
      counted: monthDates.length,
      flow: moneyFlow(rows, dataMonth),
      curve: spendCurve(daily, dataMonth, todayDate),
    };
  }, [rows, dataMonth, range, todayDate]);

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
        <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
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
            <div className="grid gap-12 lg:grid-cols-[3fr_2fr]">
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
  curve: SpendCurveData;
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
  const share = useMemo(() => categoryShare(rows, months), [rows, months]);
  const catName = (id: string) => byId.get(id)?.name ?? "A category";

  const cols = useMemo(() => {
    const isNow = (m: MonthTotals) => m.month === d.month;
    const soFar = (m: MonthTotals) => (isNow(m) && d.running ? " so far" : "");
    const muted = alpha(C.text, 0.55);
    const faint = alpha(C.text, 0.2);

    // Spending, month by month: fixed under flexible, this month in lime.
    const spend: MonthRow[] = all.map((m) => {
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
        label: compactMoney(m.spent),
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

    // Investing: one jar per month.
    const invest: Jar[] = all.map((m) => ({
      month: m.month,
      invested: m.invested,
      rate: m.income > 0 ? m.invested / m.income : null,
      current: isNow(m),
    }));
    return { spend, invest };
  }, [all, d, money]);

  const usualMonth = d.confidence !== "none" ? d.spending.usualMonth : null;
  const limitValue = d.budget.overall?.limit;

  const [flowText, flowTone] = moneyFlowTakeaway(extra.flow);
  const [spendText, spendTone] = spendingTakeaway(d);
  const [investText, investTone] = investingTakeaway(d);

  const shareTotal = share.reduce((t, r) => t + r.amount, 0);
  const topShare = share[0];
  const { stats } = extra;

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

      {extra.curve.elapsed > 0 && (
        <Reveal>
          <Panel
            id="curve"
            title="Spend curve"
            note="Running total"
            takeaway={`${money(extra.curve.current.at(-1) ?? 0)} spent${d.running ? " so far" : ""}.`}
          >
            <SpendCurve month={d.month} curve={extra.curve} budget={limitValue ?? null} />
          </Panel>
        </Reveal>
      )}

      <Reveal className="grid gap-14 lg:gap-12 lg:grid-cols-2">
        <Panel id="spending" title="Spending by month" takeaway={spendText} tone={spendTone}>
          <MonthRows
            rows={cols.spend}
            band={usualMonth}
            limit={limitValue}
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
            {limitValue && (
              <Key shape="dash" className="border-ink/70">
                Budget {compactMoney(limitValue)}
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

        <Panel id="investing" title="Investing" takeaway={investText} tone={investTone}>
          <div
            className={cx(
              "grid items-end gap-6",
              d.investing.rate !== null && "sm:grid-cols-[150px_1fr]",
            )}
          >
            {d.investing.rate !== null && (
              <div className="flex flex-col items-center">
                <RateGauge
                  rate={d.investing.rate}
                  usual={d.investing.usualRate ? d.investing.usualRate : null}
                />
                {d.investing.usualRate !== null && (
                  <span className="-mt-3 inline-flex items-center gap-1.5 text-[13px] text-muted">
                    {d.investing.usualRate > 0 && (
                      <span
                        aria-hidden="true"
                        className="inline-block h-3 w-[3px] rounded bg-ink"
                      />
                    )}
                    usually {pct(d.investing.usualRate)}
                  </span>
                )}
              </div>
            )}
            <InvestJars jars={cols.invest} onPick={onPick} />
          </div>
          <p className="text-sm text-muted">
            Each jar is a month, filled to what you invested. Under it: share of income.
          </p>
        </Panel>
      </Reveal>

      <Reveal
        className={cx(
          "grid gap-14 lg:gap-12",
          share.length > 1 && topShare && "lg:grid-cols-[3fr_2fr]",
        )}
      >
        {share.length > 1 && topShare && (
          <Panel
            id="share"
            title="Where spending usually goes"
            note={`Last ${months.length} ${months.length === 1 ? "month" : "months"}`}
            takeaway={`${topShare.key === OTHER ? "The rest" : catName(topShare.key)} takes ${pct(topShare.amount / shareTotal)}`}
          >
            <CategoryDonut share={share} byId={byId} />
          </Panel>
        )}

        <Panel
          id="rhythm"
          title="Daily rhythm"
          takeaway={`Spent on ${stats.spentDays} of ${extra.counted} days`}
        >
          <CalendarHeat month={d.month} daily={extra.daily} todayDate={todayDate} />
          <div className="flex flex-col gap-3 pt-4">
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
    </>
  );
}
