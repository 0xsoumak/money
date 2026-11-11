import { addMonths, budgetProgress, daysInMonth, today } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BudgetRing } from "../../components/BudgetRing";
import { DailyBars, MonthTrend, type Stat, StatStrip } from "../../components/Charts";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { CountUp, Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { ShareBar } from "../../components/ShareBar";
import { TransactionList } from "../../components/TransactionList";
import { Button, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { categoriesQuery, summaryQuery, transactionsQuery, trendQuery } from "../../lib/queries";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

export const Route = createFileRoute("/_app/")({
  component: Overview,
});

const RECENT = 8;

function Overview() {
  const { month, setMonth } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });
  const trend = useQuery({ ...trendQuery(month), placeholderData: keepPreviousData });

  const loading = summary.isPending || txs.isPending;
  const expenses = (summary.data?.byCategory ?? []).filter((r) => r.type === "expense");
  const recent = (txs.data ?? []).slice(0, RECENT);
  const empty = !loading && (txs.data?.length ?? 0) === 0;

  const spent = summary.data?.spent ?? 0;
  const budget = summary.data?.budget;
  const overall = budget?.overall ?? null;
  const overallProgress = overall ? budgetProgress(spent, overall) : null;
  const spentBy = new Map(expenses.map((r) => [r.categoryId, r.total]));
  const categoryBudgets = categories
    .filter((c) => budget?.categories[c.id])
    .map((c) => {
      const limit = budget?.categories[c.id] ?? 0;
      return { c, limit, spent: spentBy.get(c.id) ?? 0 };
    })
    .sort(
      (a, b) => budgetProgress(b.spent, b.limit).ratio - budgetProgress(a.spent, a.limit).ratio,
    );
  const hasBudgets = overall !== null || categoryBudgets.length > 0;

  // ── Daily figures for the charts and stat strip ──
  const todayDate = today();
  const monthDays = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const isCurrent = todayDate.startsWith(month);
  const isFuture = `${month}-01` > todayDate;
  const elapsed = isCurrent ? Number(todayDate.slice(8)) : isFuture ? 0 : monthDays;
  const dailyTotals = new Map<string, number>();
  for (const t of txs.data ?? []) {
    if (t.type === "expense") dailyTotals.set(t.date, (dailyTotals.get(t.date) ?? 0) + t.amount);
  }
  const peakDay = [...dailyTotals].reduce<[string, number] | null>(
    (best, d) => (!best || d[1] > best[1] ? d : best),
    null,
  );
  const prevSpent = trend.data?.find((t) => t.month === addMonths(month, -1))?.spent ?? 0;
  // Whole currency units: paise on an average is noise.
  const avg = elapsed > 0 ? Math.round(spent / elapsed / 100) * 100 : 0;
  const projected = avg * monthDays;

  const stats: Stat[] = [
    {
      label: "Daily average",
      value: money(avg),
      hint: `over ${elapsed} ${elapsed === 1 ? "day" : "days"}`,
    },
    isCurrent
      ? {
          label: "On pace for",
          value: money(projected),
          hint:
            overall !== null
              ? projected > overall
                ? `${money(projected - overall)} over budget`
                : `${money(overall - projected)} under budget`
              : "by month end",
          tone: overall !== null && projected > overall ? "danger" : undefined,
        }
      : {
          label: "Days spent",
          value: `${dailyTotals.size} of ${monthDays}`,
          hint: `${monthDays - dailyTotals.size} no-spend days`,
        },
    {
      label: "Last month",
      value: money(prevSpent),
      hint:
        prevSpent === 0
          ? "nothing logged"
          : isCurrent
            ? `${Math.round((spent / prevSpent) * 100)}% of it spent so far`
            : spent >= prevSpent
              ? `▲ ${Math.round((spent / prevSpent - 1) * 100)}% more this month`
              : `▼ ${Math.round((1 - spent / prevSpent) * 100)}% less this month`,
    },
    {
      label: "Biggest day",
      value: money(peakDay?.[1] ?? 0),
      hint: peakDay
        ? new Date(`${peakDay[0]}T00:00:00`).toLocaleDateString("en", {
            weekday: "short",
            day: "numeric",
            month: "short",
          })
        : "–",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />

      <section className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div>
          <Label>Spent</Label>
          {loading ? (
            <Skeleton className="mt-3 h-[76px] w-72 md:h-[104px]" />
          ) : (
            <p
              className="mt-2 text-[68px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[88px] md:text-[112px]"
              aria-label={`Spent ${money(summary.data?.spent ?? 0)}`}
            >
              <CountUp value={summary.data?.spent ?? 0} format={money} />
            </p>
          )}
        </div>
        <dl className="flex flex-wrap gap-x-8 gap-y-4">
          {overallProgress && (
            <div>
              <dt>
                <Label className="text-[13px]">{overallProgress.over > 0 ? "Over" : "Left"}</Label>
              </dt>
              <dd
                className={`mt-1 text-3xl font-bold ${overallProgress.over > 0 ? "text-danger" : "text-accent"}`}
              >
                <CountUp
                  value={
                    overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining
                  }
                  format={money}
                />
              </dd>
            </div>
          )}
          <div>
            <dt>
              <Label className="text-[13px]">Income</Label>
            </dt>
            <dd className="mt-1 text-3xl font-bold">
              <CountUp value={summary.data?.income ?? 0} format={money} />
            </dd>
          </div>
          <div>
            <dt>
              <Label className="text-[13px]">Net</Label>
            </dt>
            <dd
              className={`mt-1 text-3xl font-bold ${(summary.data?.net ?? 0) < 0 ? "text-danger" : ""}`}
            >
              <CountUp value={summary.data?.net ?? 0} format={money} />
            </dd>
          </div>
        </dl>
      </section>

      {empty ? (
        <EmptyState
          title="Nothing logged this month"
          hint="Add your first expense. Press N, type the amount, press Enter."
          action={<Button onClick={openNew}>Add expense</Button>}
        />
      ) : (
        <>
          <Reveal i={0}>
            <StatStrip stats={stats} />
          </Reveal>

          <Reveal i={1}>
            <ShareBar
              items={expenses}
              categories={categories}
              left={
                overallProgress && overallProgress.over === 0
                  ? overallProgress.remaining
                  : undefined
              }
            />
          </Reveal>

          <Reveal i={2} className="grid gap-x-10 gap-y-8 lg:grid-cols-[3fr_2fr]">
            <section>
              <SectionHeader title="Day by day" />
              <div className="mt-5">
                <DailyBars
                  month={month}
                  totals={dailyTotals}
                  todayDate={todayDate}
                  dailyBudget={overall !== null ? Math.round(overall / monthDays) : undefined}
                />
              </div>
            </section>
            <section>
              <SectionHeader title="Last 6 months" />
              <div className="mt-5">
                {trend.data ? (
                  <MonthTrend months={trend.data} current={month} onPick={setMonth} />
                ) : (
                  <Skeleton className="h-[188px]" />
                )}
              </div>
            </section>
          </Reveal>

          <section>
            <SectionHeader
              title="Recent"
              right={
                (txs.data?.length ?? 0) > RECENT ? (
                  <Link
                    to="/transactions"
                    search={(prev: { month?: string }) => ({ month: prev.month })}
                    className="min-h-6 text-sm font-bold uppercase tracking-wider text-accent"
                  >
                    All {txs.data?.length}
                  </Link>
                ) : undefined
              }
            />
            <div className="mt-5">
              <TransactionList
                transactions={recent}
                categories={categories}
                onDelete={deleteWithUndo}
              />
            </div>
          </section>
        </>
      )}

      {!loading && (
        <section>
          <SectionHeader
            title="Budgets"
            right={
              <Link
                to="/budgets"
                search={(prev: { month?: string }) => ({ month: prev.month })}
                className="min-h-6 text-sm font-bold uppercase tracking-wider text-accent"
              >
                {hasBudgets ? "Manage" : "Set up"}
              </Link>
            }
          />
          {hasBudgets ? (
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {overall !== null && <BudgetRing name="Overall" spent={spent} limit={overall} />}
              {categoryBudgets.map(({ c, limit, spent: s }) => (
                <BudgetRing key={c.id} name={`${c.emoji} ${c.name}`} spent={s} limit={limit} />
              ))}
            </div>
          ) : (
            <p className="border-b border-line py-5 text-muted">
              Set a monthly budget to see how much you have left to spend.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
