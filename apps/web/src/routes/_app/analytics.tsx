import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  analyticsWindow,
  type Decisions,
  dailyExpenses,
  dayStats,
  decisions,
  isNotable,
  type MonthTotals,
  monthTitle,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CashflowTable } from "../../components/analytics/CashflowTable";
import { Dumbbell, type DumbbellRow } from "../../components/charts/Dumbbell";
import { compactMoney, Key, Legend, Panel, TipRow, type Tone } from "../../components/charts/kit";
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
  const { month } = useMonth();
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

  const rhythm = useMemo(() => {
    if (!q.data) return null;
    const daily = dailyExpenses(q.data.rows);
    const win = analyticsWindow(q.data.to, range, todayDate);
    const averages = weekdayAverages(daily, win.dates);
    const monthDates = win.dates.filter((x) => x.startsWith(q.data.to));
    return {
      daily,
      averages,
      headline: weekdayHeadline(averages),
      stats: dayStats(daily, monthDates),
      counted: monthDates.length,
    };
  }, [q.data, range, todayDate]);

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      <div
        aria-busy={q.isPlaceholderData}
        className={cx(
          "flex flex-col gap-8 transition-opacity duration-300",
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
          <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
            <Skeleton className="h-[380px]" />
            <Skeleton className="h-[380px]" />
          </div>
        ) : q.data?.rows.length === 0 ? (
          <EmptyState
            title="Nothing to analyse yet"
            hint="This page fills in as you log expenses, income and investments."
            action={<Button onClick={() => openNew()}>Add expense</Button>}
          />
        ) : (
          d &&
          rhythm && (
            <Sections
              d={d}
              byId={byId}
              money={money}
              rhythm={rhythm}
              todayDate={todayDate}
              range={range}
            />
          )
        )}
      </div>
    </div>
  );
}

function Sections({
  d,
  byId,
  money,
  rhythm,
  todayDate,
  range,
}: {
  d: Decisions;
  byId: Map<string, Category>;
  money: Money;
  rhythm: {
    daily: Map<string, number>;
    averages: number[];
    headline: string | null;
    stats: ReturnType<typeof dayStats>;
    counted: number;
  };
  todayDate: string;
  range: number;
}) {
  const all = [...d.history, d.current];
  const isNow = (m: MonthTotals) => m.month === d.month;
  const soFar = (m: MonthTotals) => (isNow(m) && d.running ? " so far" : "");
  const missed = new Set(d.consistency.months.filter((m) => m.invested === 0).map((m) => m.month));

  // ── Spending, month by month ──
  const spendCols: Column[] = all.map((m) => {
    const now = isNow(m);
    const likely = now && d.running ? d.spending.projected.mid : undefined;
    return {
      month: m.month,
      current: now,
      parts: [
        { value: m.fixed, className: "fill-ink/20" },
        { value: m.flexible, className: now ? "fill-accent" : "fill-ink/55" },
      ],
      ghost: likely,
      label: now ? compactMoney(m.spent) : undefined,
      aria: `${monthTitle(m.month)}: spent ${money(m.spent)}${soFar(m)}${likely ? `, likely ${money(likely)}` : ""}`,
      tip: (
        <>
          <TipRow swatch="bg-ink" value={money(m.spent)} name={`spent${soFar(m)}`} />
          {d.hasFixed && (
            <>
              <TipRow
                swatch={now ? "bg-accent" : "bg-ink/55"}
                value={money(m.flexible)}
                name="flexible"
              />
              <TipRow swatch="bg-ink/20" value={money(m.fixed)} name="fixed" />
            </>
          )}
          {likely !== undefined && likely > m.spent && (
            <TipRow swatch="bg-ink/30" value={money(likely)} name="likely by month end" />
          )}
        </>
      ),
    };
  });
  const usualMonth = d.confidence !== "none" ? d.spending.usualMonth : null;
  const limit = d.budget.overall?.limit;
  const [spendText, spendTone] = spendingTakeaway(d);

  // ── What changed ──
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
  const [changeText, changeTone] = changesTakeaway(d, byId);

  // ── Income vs outgoings ──
  const flowCols: Column[] = all.map((m) => ({
    month: m.month,
    current: isNow(m),
    parts: [
      { value: m.spent, className: "fill-ink/45" },
      { value: m.invested, className: "fill-accent" },
    ],
    marker: m.income,
    sub:
      m.income > 0 ? (
        <span className={m.left < 0 ? "font-semibold text-danger" : undefined}>
          {m.left < 0 ? "" : "+"}
          {compactMoney(m.left)}
        </span>
      ) : (
        "–"
      ),
    aria: `${monthTitle(m.month)}: earned ${money(m.income)}, spent ${money(m.spent)}, invested ${money(m.invested)}, ${m.left < 0 ? `short by ${money(-m.left)}` : `${money(m.left)} left`}`,
    tip: (
      <>
        <TipRow swatch="bg-ink" value={money(m.income)} name="earned" />
        <TipRow swatch="bg-ink/45" value={money(m.spent)} name="spent" />
        <TipRow swatch="bg-accent" value={money(m.invested)} name="invested" />
        <TipRow
          value={`${m.left < 0 ? "−" : ""}${money(Math.abs(m.left))}`}
          name={m.left < 0 ? "short" : "left"}
          tone={m.left < 0 ? "danger" : undefined}
        />
      </>
    ),
  }));
  const [flowText, flowTone] = cashflowTakeaway(all);

  // ── Investing ──
  const investCols: Column[] = all.map((m) => {
    const now = isNow(m);
    const rate = m.income > 0 ? m.invested / m.income : null;
    return {
      month: m.month,
      current: now,
      parts: [{ value: m.invested, className: "fill-accent" }],
      missing: missed.has(m.month),
      label: now && m.invested > 0 ? compactMoney(m.invested) : undefined,
      sub: rate !== null ? pct(rate) : "–",
      aria: `${monthTitle(m.month)}: ${m.invested > 0 ? `invested ${money(m.invested)}` : "nothing invested"}${rate !== null ? `, ${pct(rate)} of income` : ""}`,
      tip: (
        <>
          <TipRow
            swatch="bg-accent"
            value={m.invested > 0 ? money(m.invested) : "Nothing"}
            name={`invested${soFar(m)}`}
          />
          {rate !== null && <TipRow value={pct(rate)} name="of income" />}
        </>
      ),
    };
  });
  const usualInvest = d.confidence !== "none" ? d.investing.usual : null;
  const [investText, investTone] = investingTakeaway(d);

  const { stats } = rhythm;

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

      <Reveal className={cx("grid gap-5", dumbbell.length > 0 && "lg:grid-cols-[3fr_2fr]")}>
        <Panel id="spending" title="Spending by month" takeaway={spendText} tone={spendTone}>
          <MonthColumns
            columns={spendCols}
            band={usualMonth}
            limit={limit ? { value: limit, label: `Budget ${compactMoney(limit)}` } : null}
            height={220}
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

      <Reveal>
        <Panel id="cashflow" title="Income vs outgoings" takeaway={flowText} tone={flowTone}>
          <MonthColumns columns={flowCols} height={220} />
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
          <MonthColumns columns={investCols} band={usualInvest} height={200} />
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
          takeaway={`Spent on ${stats.spentDays} of ${rhythm.counted} days`}
        >
          <CalendarHeat month={d.month} daily={rhythm.daily} todayDate={todayDate} />
          <div className="flex flex-col gap-3 border-t-2 border-line pt-5">
            <p className="text-[15px] font-semibold">
              {rhythm.headline ?? "Average spend by weekday"}
              <span className="block text-[13px] font-normal text-muted">
                Average per day, last {range} months
              </span>
            </p>
            <WeekdayBars averages={rhythm.averages} />
          </div>
        </Panel>
      </Reveal>
    </>
  );
}
