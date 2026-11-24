import {
  against,
  analyticsWindow,
  budgetProgress,
  type Decisions,
  dailyExpenses,
  decisions,
  today,
  weekdayAverages,
  weekdayHeadline,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { BudgetRing } from "../../components/BudgetRing";
import { compactMoney, Panel, type Tone } from "../../components/charts/kit";
import { PaceChart } from "../../components/charts/PaceChart";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { CountUp, Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { ShareBar } from "../../components/ShareBar";
import { TransactionList } from "../../components/TransactionList";
import { Button, cx, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import {
  analyticsQuery,
  categoriesQuery,
  summaryQuery,
  transactionsQuery,
} from "../../lib/queries";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

export const Route = createFileRoute("/_app/")({
  component: Overview,
});

const RECENT = 5;

/** A few words over the pace chart: the budget first, then how this month compares. */
function paceTakeaway(d: Decisions): [string, Tone] {
  const now = d.spending.pace.current.at(-1) ?? 0;
  const p = d.spending.projected;
  const o = d.budget.overall;
  if (o && now > o.limit) return [`${compactMoney(now - o.limit)} over budget`, "warn"];
  if (o && d.running && d.elapsed >= 7 && p.mid > o.limit)
    return [`Heading ${compactMoney(p.mid - o.limit)} over budget`, "warn"];
  const u = d.elapsed > 0 ? d.spending.pace.usual?.[d.elapsed - 1] : undefined;
  if (!u)
    return d.running
      ? [`Likely ${compactMoney(p.mid)} by month end`, "info"]
      : [`${compactMoney(now)} spent`, "info"];
  const by = d.running ? " for this point in the month" : "";
  switch (against(now, { ...u, n: 0 })) {
    case "above":
      return [`${compactMoney(now - u.high)} above usual${by}`, "warn"];
    case "below":
      // Thin logging looks like saving, so it never earns praise.
      return [`${compactMoney(u.low - now)} below usual${by}`, d.logging.thin ? "info" : "good"];
    default:
      return [`In your usual range${by}`, "info"];
  }
}

function Overview() {
  const { month } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const loading = summary.isPending || txs.isPending;
  const stale = summary.isPlaceholderData || txs.isPlaceholderData;
  const income = summary.data?.income ?? 0;
  const savedPct = income > 0 ? Math.round(((summary.data?.invested ?? 0) / income) * 100) : null;
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
  // Only budgets at 80% or more make the overview; the rest are summed up in words.
  const atRisk = [
    ...(overall !== null ? [{ key: "overall", name: "Overall", limit: overall, spent }] : []),
    ...categoryBudgets.map(({ c, limit, spent: s }) => ({
      key: c.id,
      name: `${c.emoji} ${c.name}`,
      limit,
      spent: s,
    })),
  ].filter((b) => budgetProgress(b.spent, b.limit).state !== "ok");
  const budgetCount = (overall !== null ? 1 : 0) + categoryBudgets.length;
  const onTrack = budgetCount - atRisk.length;

  // ── This month against the usual: the pace chart, and a line from Analytics ──
  const todayDate = today();
  const analytics = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });
  const fixedIds = useMemo(
    () => new Set(categories.filter((c) => c.fixed).map((c) => c.id)),
    [categories],
  );
  const categoryBudgetMap = budget?.categories;
  const d = useMemo(
    () =>
      analytics.data
        ? decisions({
            rows: analytics.data.rows,
            month: analytics.data.to,
            range: 6,
            todayDate,
            budgets: { overall, byCategory: categoryBudgetMap ?? {} },
            fixedIds,
          })
        : null,
    [analytics.data, todayDate, overall, categoryBudgetMap, fixedIds],
  );
  const [paceText, paceTone] = d ? paceTakeaway(d) : ["", "info" as Tone];

  // The biggest rise from Analytics, or the weekday pattern when nothing stands out.
  const teaser = useMemo(() => {
    if (!analytics.data || !d) return null;
    const up = d.spending.movers.find((m) => m.diff > 0);
    const cat = up && categories.find((c) => c.id === up.key);
    if (up && cat) return `${cat.name} is ${compactMoney(up.diff)} above usual.`;
    const { dates } = analyticsWindow(analytics.data.to, 3, todayDate);
    return weekdayHeadline(weekdayAverages(dailyExpenses(analytics.data.rows), dates));
  }, [analytics.data, d, categories, todayDate]);

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      {/* While another month loads, the previous month's numbers stay up: dim them so they don't read as this month's. */}
      <div
        aria-busy={stale}
        className={cx(
          "flex flex-col gap-8 transition-opacity duration-300",
          stale && "pointer-events-none opacity-35",
        )}
      >
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
                  <Label className="text-[13px]">
                    {overallProgress.over > 0 ? "Over" : "Left"}
                  </Label>
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
                <Label className="text-[13px]">Invested</Label>
              </dt>
              <dd className="mt-1">
                <Link
                  to="/investments"
                  search={(prev: { month?: string }) => ({ month: prev.month })}
                  className="text-3xl font-bold underline decoration-line-strong/30 decoration-2 underline-offset-[6px] hover:decoration-accent"
                >
                  <CountUp value={summary.data?.invested ?? 0} format={money} />
                </Link>
                {savedPct !== null && (
                  <span className="mt-0.5 block text-sm text-muted">{savedPct}% of income</span>
                )}
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
            action={<Button onClick={() => openNew()}>Add expense</Button>}
          />
        ) : (
          <>
            <Reveal>
              {d ? (
                <Panel
                  title={d.running ? "This month's pace" : "How the month went"}
                  takeaway={paceText}
                  tone={paceTone}
                >
                  <PaceChart
                    month={d.month}
                    current={d.spending.pace.current}
                    days={d.days}
                    usual={d.confidence === "none" ? null : d.spending.pace.usual}
                    projected={d.running ? d.spending.projected : null}
                    budget={overall}
                  />
                </Panel>
              ) : (
                <Skeleton className="h-[380px]" />
              )}
            </Reveal>

            <Reveal>
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

            {!loading && (
              <section>
                <SectionHeader
                  title="Needs attention"
                  right={
                    <Link
                      to="/budgets"
                      search={(prev: { month?: string }) => ({ month: prev.month })}
                      className="-my-3 inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-accent"
                    >
                      {hasBudgets ? "Manage" : "Set up"}
                    </Link>
                  }
                />
                {!hasBudgets ? (
                  <p className="border-b border-line py-5 text-muted">
                    Set a monthly budget to see how much you have left to spend.
                  </p>
                ) : atRisk.length === 0 ? (
                  <p className="border-b border-line py-5 text-muted">
                    {budgetCount === 1
                      ? "Your budget is on track."
                      : `All ${budgetCount} budgets on track.`}
                  </p>
                ) : (
                  <>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {atRisk.map((b) => (
                        <BudgetRing key={b.key} name={b.name} spent={b.spent} limit={b.limit} />
                      ))}
                    </div>
                    {onTrack > 0 && (
                      <p className="pt-3 text-sm text-muted">
                        {onTrack} other {onTrack === 1 ? "budget" : "budgets"} on track
                      </p>
                    )}
                  </>
                )}
              </section>
            )}

            <section>
              <SectionHeader
                title="Recent"
                right={
                  (txs.data?.length ?? 0) > RECENT ? (
                    <Link
                      to="/transactions"
                      search={(prev: { month?: string }) => ({ month: prev.month })}
                      className="-my-3 inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wider text-accent"
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
            <Link
              to="/analytics"
              search={(prev: { month?: string }) => ({ month: prev.month })}
              className="group flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-xl border-2 border-line-strong px-6 py-5 transition-colors hover:border-accent"
            >
              <span>
                <Label className="text-[13px]">From your analytics</Label>
                <span className="mt-1.5 block text-2xl font-bold tracking-[-0.02em]">
                  {teaser ?? "See where your money really goes."}
                </span>
              </span>
              <span className="inline-flex min-h-12 items-center rounded-lg bg-accent px-5 text-sm font-bold uppercase tracking-wider text-on-accent">
                Open analytics →
              </span>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
