import { budgetProgress, daysInMonth, lastDayOf, today } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BudgetDialog, type BudgetTarget } from "../../components/BudgetDialog";
import { BudgetBullets, HalfRing, STATE_TEXT } from "../../components/BudgetRing";
import { PencilIcon, PlusIcon } from "../../components/icons";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { Button, cx, EmptyState, SectionHeader, Skeleton } from "../../components/ui";
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
  const byName = (id: string) => categories.find((c) => c.id === id)?.name ?? "Category";
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
  // Where spending would be today if it kept exactly to the budget; only while the month runs.
  const pace = elapsed > 0 && elapsed < days ? elapsed / days : null;
  // Days still to come, counting today.
  const daysLeft = elapsed > 0 && elapsed < days ? days - elapsed + 1 : 0;
  const isOver = (overallProgress?.over ?? 0) > 0;
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
            className="group relative mt-6 grid w-full cursor-pointer items-center gap-x-14 gap-y-8 rounded-2xl text-left md:grid-cols-[auto_1fr]"
            aria-label={`Edit overall budget, ${money(overall)}`}
          >
            <span className="absolute top-0 right-0 text-muted opacity-0 transition-opacity group-hover:opacity-100">
              <PencilIcon size={18} />
            </span>
            <span className="flex flex-col items-center gap-3 justify-self-center">
              <HalfRing
                spent={spent}
                limit={overall}
                width={360}
                stroke={32}
                textClass="text-[52px]"
                pace={pace}
              >
                <span className="flex flex-col items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
                    {isOver ? "Over by" : "Left to spend"}
                  </span>
                  <span className={isOver ? "text-danger" : "text-accent"}>
                    {money(isOver ? overallProgress.over : overallProgress.remaining)}
                  </span>
                </span>
              </HalfRing>
              {pace !== null && (
                <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                  <span
                    aria-hidden="true"
                    className="inline-block h-3.5 w-[2.5px] rounded bg-ink"
                  />
                  Where you should be by today
                </span>
              )}
            </span>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-7">
              <Fact label="Spent" value={money(spent)} sub={`of ${money(overall)}`} />
              <Fact
                label="Used"
                value={`${usedPct}%`}
                valueClass={STATE_TEXT[overallProgress.state]}
                sub={daysLeft > 0 ? `in ${monthPct}% of the month` : undefined}
                subClass={daysLeft > 0 ? STATE_TEXT[paceState] : undefined}
              />
              {daysLeft > 0 && (
                <Fact
                  label="Days left"
                  value={String(daysLeft)}
                  sub={`Day ${elapsed} of ${days}`}
                />
              )}
              {daysLeft > 0 && (
                <Fact
                  label="Per day from here"
                  value={isOver ? "–" : money(Math.floor(overallProgress.remaining / daysLeft))}
                  valueClass={isOver ? "text-danger" : undefined}
                  sub={isOver ? "Already over budget" : "to stay within budget"}
                />
              )}
            </dl>
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
          <div className="mt-4">
            <BudgetBullets
              rows={withLimit.map(({ c, limit, spent: s }) => ({
                key: c.id,
                name: `${c.emoji} ${c.name}`,
                spent: s,
                limit,
              }))}
              pace={pace}
              onPick={(r) =>
                setTarget({ key: r.key, title: byName(r.key), current: r.limit, spent: r.spent })
              }
            />
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
          <ul className="mt-2 grid gap-x-12 sm:grid-cols-2">
            {withoutLimit.map((c) => {
              const s = spentBy.get(c.id) ?? 0;
              return (
                <li key={c.id} className="border-b border-line">
                  <button
                    type="button"
                    aria-label={`Set a limit for ${c.name}`}
                    onClick={() => setTarget({ key: c.id, title: c.name, current: null, spent: s })}
                    className="group flex min-h-14 w-full cursor-pointer items-center gap-3 py-3 text-left"
                  >
                    <span className="min-w-0 flex-1 truncate font-semibold">
                      {c.emoji} {c.name}
                    </span>
                    <span className="text-sm tabular-nums text-muted">{money(s)} this month</span>
                    <span className="inline-flex items-center gap-1 rounded-lg border-2 border-line px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-muted transition-colors group-hover:border-accent group-hover:text-accent">
                      <PlusIcon size={12} /> Limit
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

/** One figure beside the overall gauge: small label, big value, a line under it. */
function Fact({
  label,
  value,
  sub,
  valueClass,
  subClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
  subClass?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd
        className={cx(
          "m-0 truncate text-[32px] font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-[40px]",
          valueClass,
        )}
      >
        {value}
      </dd>
      {sub && <dd className={cx("m-0 text-sm font-semibold text-muted", subClass)}>{sub}</dd>}
    </div>
  );
}
