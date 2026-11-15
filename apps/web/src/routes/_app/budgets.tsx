import { budgetProgress, daysInMonth, lastDayOf, today } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BudgetDialog, type BudgetTarget } from "../../components/BudgetDialog";
import { BudgetRing, Ring, STATE_TEXT } from "../../components/BudgetRing";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Button, cx, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { categoriesQuery, summaryQuery } from "../../lib/queries";

export const Route = createFileRoute("/_app/budgets")({
  component: BudgetsPage,
});

function BudgetsPage() {
  const { month } = useMonth();
  const money = useMoney();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const { data: summary, isPending } = useQuery({
    ...summaryQuery(month),
    placeholderData: keepPreviousData,
  });
  const [target, setTarget] = useState<BudgetTarget | null>(null);

  const spentBy = new Map(
    (summary?.byCategory ?? [])
      .filter((r) => r.type === "expense")
      .map((r) => [r.categoryId, r.total]),
  );
  const overall = summary?.budget.overall ?? null;
  const spent = summary?.spent ?? 0;
  const expenseCategories = categories.filter((c) => c.kind === "expense" && !c.archivedAt);

  // Budgeted categories first (most used first), then the ones without a limit.
  const withLimit = expenseCategories
    .filter((c) => summary?.budget.categories[c.id])
    .map((c) => {
      const limit = summary?.budget.categories[c.id] ?? 0;
      return { c, limit, spent: spentBy.get(c.id) ?? 0 };
    })
    .sort(
      (a, b) => budgetProgress(b.spent, b.limit).ratio - budgetProgress(a.spent, a.limit).ratio,
    );
  const withoutLimit = expenseCategories.filter((c) => !summary?.budget.categories[c.id]);

  const overallProgress = overall ? budgetProgress(spent, overall) : null;

  // How far through the month we are, to set against how much of the budget is used.
  const todayDate = today();
  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const elapsed = todayDate.startsWith(month)
    ? Number(todayDate.slice(8))
    : todayDate > lastDayOf(month)
      ? days
      : 0;
  const monthPct = Math.round((elapsed / days) * 100);
  const usedPct = overallProgress ? Math.round(overallProgress.ratio * 100) : 0;
  // Ahead of the month's pace reads as a warning (or worse, if already over).
  const paceState =
    !overallProgress || usedPct <= monthPct
      ? "ok"
      : overallProgress.state === "over"
        ? "over"
        : "warning";

  return (
    <div className="flex flex-col gap-10">
      <MonthSwitcher />
      <h1 className="text-[56px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[80px]">
        Budgets
      </h1>

      <section>
        <SectionHeader title="Overall" />
        {isPending ? (
          <Skeleton className="mt-5 h-[200px]" />
        ) : overall && overallProgress ? (
          <button
            type="button"
            onClick={() => setTarget({ key: "overall", title: "Overall", current: overall, spent })}
            className="mt-5 flex w-full cursor-pointer flex-wrap items-center gap-x-10 gap-y-6 rounded-2xl border-2 border-line p-6 text-left transition-colors hover:border-line-strong/60 sm:p-8"
            aria-label={`Edit overall budget, ${money(overall)}`}
          >
            <Ring spent={spent} limit={overall} size={176} stroke={18} textClass="text-[40px]" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <Label>{overallProgress.over > 0 ? "Over budget by" : "Left to spend"}</Label>
              <span
                className={cx(
                  "text-[64px] font-bold leading-none tracking-[-0.06em] sm:text-[88px]",
                  overallProgress.over > 0 ? "text-danger" : "text-accent",
                )}
              >
                {money(overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining)}
              </span>
              <span className="mt-2 text-lg">
                {money(spent)} <span className="text-muted">of {money(overall)} spent</span>
              </span>
              {elapsed > 0 && elapsed < days && (
                <span className="text-sm text-muted">
                  Day {elapsed} of {days}:{" "}
                  <span className={cx("font-bold", STATE_TEXT[paceState])}>
                    {usedPct}% of budget used
                  </span>{" "}
                  in {monthPct}% of the month
                </span>
              )}
            </span>
          </button>
        ) : (
          <EmptyState
            title="No overall budget"
            hint="Set one limit for everything you spend in a month. The overview then shows how much is left."
            action={
              <Button
                onClick={() =>
                  setTarget({ key: "overall", title: "Overall", current: null, spent })
                }
              >
                Set monthly budget
              </Button>
            }
          />
        )}
      </section>

      <section>
        <SectionHeader
          title="By category"
          right={
            withLimit.length > 0 ? (
              <span className="text-sm text-muted">
                {withLimit.filter((b) => budgetProgress(b.spent, b.limit).state === "over").length}{" "}
                over · {withLimit.length} set
              </span>
            ) : undefined
          }
        />
        {withLimit.length > 0 ? (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {withLimit.map(({ c, limit, spent: s }) => (
              <BudgetRing
                key={c.id}
                name={`${c.emoji} ${c.name}`}
                spent={s}
                limit={limit}
                onClick={() => setTarget({ key: c.id, title: c.name, current: limit, spent: s })}
              />
            ))}
          </div>
        ) : (
          !isPending && (
            <p className="border-b border-line py-5 text-muted">
              No category limits yet. Pick a category below to set one.
            </p>
          )
        )}
      </section>

      {withoutLimit.length > 0 && (
        <section>
          <SectionHeader title="No limit" />
          <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {withoutLimit.map((c) => {
              const s = spentBy.get(c.id) ?? 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-label={`Set a limit for ${c.name}`}
                    onClick={() => setTarget({ key: c.id, title: c.name, current: null, spent: s })}
                    className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-line px-4 py-3 text-left transition-colors hover:border-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {c.emoji} {c.name}
                      </span>
                      <span className="text-[13px] text-muted">{money(s)} this month</span>
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-muted transition-colors group-hover:text-accent">
                      + Limit
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <BudgetDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
