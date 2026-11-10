import { budgetProgress } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BlockMeter, BudgetRow, BudgetStatus } from "../../components/BlockMeter";
import { BudgetDialog, type BudgetTarget } from "../../components/BudgetDialog";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Button, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
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

  return (
    <div className="flex max-w-3xl flex-col gap-9">
      <MonthSwitcher />
      <h1 className="text-5xl font-bold tracking-[-0.04em]">Budgets</h1>

      <section>
        <SectionHeader title="Overall" />
        {isPending ? (
          <Skeleton className="mt-4 h-32" />
        ) : overall && overallProgress ? (
          <button
            type="button"
            onClick={() => setTarget({ key: "overall", title: "Overall", current: overall, spent })}
            className="block w-full cursor-pointer border-b border-line py-5 text-left"
            aria-label={`Edit overall budget, ${money(overall)}`}
          >
            <Label>{overallProgress.over > 0 ? "Over budget by" : "Left to spend"}</Label>
            <span
              className={`mt-1 block text-6xl font-bold leading-none tracking-[-0.05em] ${overallProgress.over > 0 ? "text-danger" : "text-accent"}`}
            >
              {money(overallProgress.over > 0 ? overallProgress.over : overallProgress.remaining)}
            </span>
            <BlockMeter spent={spent} limit={overall} label="Overall" className="mt-5" />
            <span className="mt-2 flex justify-between text-[13px] text-muted">
              <span>
                {money(spent)} of {money(overall)} spent
              </span>
              <BudgetStatus spent={spent} limit={overall} />
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
        <SectionHeader title="By category" />
        {withLimit.map(({ c, limit, spent: s }) => (
          <BudgetRow
            key={c.id}
            name={`${c.emoji} ${c.name}`}
            spent={s}
            limit={limit}
            onClick={() => setTarget({ key: c.id, title: c.name, current: limit, spent: s })}
          />
        ))}
        {withLimit.length === 0 && !isPending && (
          <p className="border-b border-line py-5 text-muted">
            No category limits yet. Pick a category below to set one.
          </p>
        )}

        {withoutLimit.length > 0 && (
          <>
            <p className="mt-7 text-sm font-bold uppercase tracking-[0.12em] text-muted">
              No limit
            </p>
            <ul>
              {withoutLimit.map((c) => {
                const s = spentBy.get(c.id) ?? 0;
                return (
                  <li key={c.id} className="flex items-center gap-3 border-b border-line">
                    <span className="min-w-0 flex-1 py-3">
                      <span className="block truncate text-base font-semibold">
                        {c.emoji} {c.name}
                      </span>
                      <span className="text-[13px] text-muted">{money(s)} this month</span>
                    </span>
                    <Button
                      variant="ghost"
                      className="min-h-11"
                      aria-label={`Set a limit for ${c.name}`}
                      onClick={() =>
                        setTarget({ key: c.id, title: c.name, current: null, spent: s })
                      }
                    >
                      Set limit
                    </Button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <BudgetDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}
