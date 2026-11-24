import { investedByMonth, monthTitle } from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { InvestBars } from "../../components/charts/InvestBars";
import { Panel } from "../../components/charts/kit";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { CountUp, Reveal } from "../../components/motion";
import { useQuickAdd } from "../../components/QuickAdd";
import { TransactionList } from "../../components/TransactionList";
import { Button, cx, EmptyState, Label, SectionHeader, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import {
  analyticsQuery,
  type Category,
  categoriesQuery,
  investmentsQuery,
  transactionsQuery,
} from "../../lib/queries";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

export const Route = createFileRoute("/_app/investments")({
  component: Investments,
});

/**
 * Money put away, without fund-level detail: how much in total, per bucket
 * (MF, FD, …), per year and per month. Totals run up to the end of the month shown.
 */
function Investments() {
  const { month, setMonth } = useMonth();
  const money = useMoney();
  const { openNew } = useQuickAdd();
  const deleteWithUndo = useDeleteWithUndo();

  const { data: categories = [] } = useQuery(categoriesQuery);
  const inv = useQuery({ ...investmentsQuery(month), placeholderData: keepPreviousData });
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });
  // The analytics rows carry every investment with its type, for the stacked month chart.
  const rows = useQuery({ ...analyticsQuery(month), placeholderData: keepPreviousData });

  const thisMonth = (txs.data ?? []).filter((t) => t.type === "investment");
  const monthTotal = thisMonth.reduce((t, x) => t + x.amount, 0);
  const year = month.slice(0, 4);
  const stale = inv.isPlaceholderData || txs.isPlaceholderData;
  const data = inv.data;
  const none = data !== undefined && data.total === 0;
  const byId = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const share = (data?.byCategory ?? [])
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((r) => ({ key: r.categoryId, amount: r.total }));
  const months = data?.months ?? [];
  const investedMonths = months.filter((m) => m.invested > 0).length;
  const top = share[0];
  const stacked = investedByMonth(
    rows.data?.rows ?? [],
    months.map((m) => m.month),
  );

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      <div
        aria-busy={stale}
        className={cx(
          "flex flex-col gap-8 transition-opacity duration-300",
          stale && "pointer-events-none opacity-35",
        )}
      >
        <section className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
          <div>
            <Label>Invested so far</Label>
            {!data ? (
              <Skeleton className="mt-3 h-[76px] w-72 md:h-[104px]" />
            ) : (
              <p
                className="mt-2 text-[68px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[88px] md:text-[112px]"
                aria-label={`Invested so far ${money(data.total)}`}
              >
                <CountUp value={data.total} format={money} />
              </p>
            )}
            <p className="mt-3 text-sm text-muted">
              Everything up to the end of {monthTitle(month)}
            </p>
          </div>
          <dl className="flex flex-wrap gap-x-8 gap-y-4">
            {[
              { label: "This month", value: monthTotal },
              { label: `In ${year}`, value: data?.thisYear ?? 0 },
              { label: `In ${Number(year) - 1}`, value: data?.lastYear ?? 0 },
            ].map((s) => (
              <div key={s.label}>
                <dt>
                  <Label className="text-[13px]">{s.label}</Label>
                </dt>
                <dd className="mt-1 text-3xl font-bold">
                  <CountUp value={s.value} format={money} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {none ? (
          <EmptyState
            title="No investments logged yet"
            hint="Log what you put into mutual funds, FDs, PPF and so on. Just the amount and where it went."
            action={<Button onClick={() => openNew("investment")}>Log an investment</Button>}
          />
        ) : (
          <>
            {data ? (
              <Reveal>
                <Panel
                  id="months"
                  title={`Last ${months.length} months`}
                  note={
                    top
                      ? `${byId.get(top.key)?.name ?? "One type"} holds ${Math.round((top.amount / data.total) * 100)}% of all of it`
                      : undefined
                  }
                  takeaway={`Invested in ${investedMonths} of ${months.length} months`}
                  tone={investedMonths >= months.length * 0.75 ? "good" : "info"}
                >
                  <InvestBars
                    months={stacked}
                    allTime={share}
                    byId={byId}
                    current={month}
                    onPick={setMonth}
                  />
                </Panel>
              </Reveal>
            ) : (
              <Skeleton className="h-[380px]" />
            )}

            <Reveal>
              <SectionHeader
                title={`${monthTitle(month)}`}
                right={
                  <button
                    type="button"
                    onClick={() => openNew("investment")}
                    className="-my-3 flex min-h-11 cursor-pointer items-center text-sm font-bold uppercase tracking-wider text-accent transition-opacity hover:opacity-75"
                  >
                    Log one
                  </button>
                }
              />
              <div className="mt-5">
                {thisMonth.length === 0 ? (
                  <p className="border-b border-line py-5 text-muted">
                    Nothing invested this month.
                  </p>
                ) : (
                  <TransactionList
                    transactions={thisMonth}
                    categories={categories}
                    onDelete={deleteWithUndo}
                  />
                )}
              </div>
            </Reveal>
          </>
        )}
      </div>
    </div>
  );
}
