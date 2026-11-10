import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { useQuickAdd } from "../../components/QuickAdd";
import { ShareBar } from "../../components/ShareBar";
import { TransactionList } from "../../components/TransactionList";
import { Button, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { categoriesQuery, summaryQuery, transactionsQuery } from "../../lib/queries";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

export const Route = createFileRoute("/_app/")({
  component: Overview,
});

const RECENT = 8;

function Overview() {
  const { month } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const summary = useQuery({ ...summaryQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const loading = summary.isPending || txs.isPending;
  const expenses = (summary.data?.byCategory ?? []).filter((r) => r.type === "expense");
  const recent = (txs.data ?? []).slice(0, RECENT);
  const empty = !loading && (txs.data?.length ?? 0) === 0;

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
              {money(summary.data?.spent ?? 0)}
            </p>
          )}
        </div>
        <dl className="flex gap-8">
          <div>
            <dt>
              <Label className="text-[13px]">Income</Label>
            </dt>
            <dd className="mt-1 text-3xl font-bold">{money(summary.data?.income ?? 0)}</dd>
          </div>
          <div>
            <dt>
              <Label className="text-[13px]">Net</Label>
            </dt>
            <dd
              className={`mt-1 text-3xl font-bold ${(summary.data?.net ?? 0) < 0 ? "text-danger" : ""}`}
            >
              {money(summary.data?.net ?? 0)}
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
          <ShareBar items={expenses} categories={categories} />

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
    </div>
  );
}
