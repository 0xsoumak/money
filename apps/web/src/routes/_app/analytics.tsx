import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type Decisions,
  decisionActions,
  decisions,
  shortMonth,
  today,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ActionList,
  AnswerCards,
  answers,
  type Bar,
  BudgetPlan,
  CashflowTable,
  InvestStrip,
  MonthBars,
  Movers,
  Question,
  type RefLine,
} from "../../components/analytics/Decisions";
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
const pct = (r: number) => `${Math.round(r * 100)}%`;

/** One sentence per question; the evidence sits underneath. */
function spendingAnswer(d: Decisions, money: Money): string {
  const usual = d.spending.usualByNow;
  if (usual === null) return `${money(d.current.spent)} spent${d.running ? " so far" : ""}.`;
  const diff = d.current.spent - usual;
  const when = d.running ? "by this point in the month" : "than a usual month";
  if (Math.abs(diff) < Math.max(50_000, usual * 0.05)) return `About your usual ${when}.`;
  return d.running
    ? `${money(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than usual ${when}.`
    : `${money(Math.abs(diff))} ${diff > 0 ? "more" : "less"} ${when}.`;
}

function investingAnswer(d: Decisions, money: Money): string {
  const { rate, usualRate } = d.investing;
  if (rate === null)
    return d.current.invested > 0
      ? `${money(d.current.invested)} invested, no income logged to compare with.`
      : "Nothing invested and no income logged.";
  const base = `${pct(rate)} of your income went to investments`;
  if (usualRate === null) return `${base}.`;
  return `${base}, ${rate >= usualRate ? "at or above" : "below"} your usual ${pct(usualRate)}.`;
}

function regularityAnswer(d: Decisions): string {
  const c = d.consistency;
  const of = `${c.investedMonths} of the last ${c.months.length} ${c.months.length === 1 ? "month" : "months"}`;
  switch (c.steadiness) {
    case "early":
      return "Too early to tell. This builds up month by month.";
    case "none":
      return `No investments in ${of.replace(/^0 of /, "")}.`;
    case "irregular":
      return `You invested in ${of}. That's irregular.`;
    case "uneven":
      return `You invest every month, but the amounts swing a lot.`;
    case "steady":
      return `Steady: you invested in ${of}${c.streak > 2 ? `, a ${c.streak}-month streak` : ""}.`;
  }
}

function cashflowAnswer(d: Decisions, money: Money): string {
  const rows = [...d.history, d.current].filter((r) => r.income > 0);
  if (rows.length === 0) return "Log your income to see how much of it you keep.";
  const short = rows.filter((r) => r.left < 0).length;
  const kept =
    rows.reduce((t, r) => t + (r.income - r.spent), 0) / rows.reduce((t, r) => t + r.income, 0);
  if (short > 0)
    return `In ${short} of ${rows.length} months you spent and invested more than you earned.`;
  const left = d.current.left;
  return `You keep ${pct(kept)} of what you earn${d.current.income > 0 ? `; ${money(left)} is unallocated this month` : ""}.`;
}

function planAnswer(d: Decisions, money: Money): string {
  const o = d.budget.overall;
  if (!o) return "No budget yet, so there's nothing to measure against.";
  if (d.current.spent > o.limit) return `${money(d.current.spent - o.limit)} over budget.`;
  if (!d.running) return `Within budget, with ${money(o.limit - d.current.spent)} to spare.`;
  return d.spending.projected > o.limit
    ? `Heading about ${money(d.spending.projected - o.limit)} over budget.`
    : `On track, with about ${money(o.limit - d.spending.projected)} to spare.`;
}

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
          })
        : null,
    [q.data, range, todayDate, budgets],
  );
  const actions = useMemo(
    () => (d ? decisionActions(d, money, (id) => byId.get(id)?.name ?? "A category") : []),
    [d, money, byId],
  );

  const all = d ? [...d.history, d.current] : [];
  const spendBars: Bar[] = all.map((m) => ({
    month: m.month,
    value: m.spent,
    current: m === d?.current,
    projected: m === d?.current && d.running ? d.spending.projected : undefined,
  }));
  const spendLines: RefLine[] = [
    ...(d?.spending.usualMonth
      ? [
          {
            value: d.spending.usualMonth,
            label: "Usual",
            className: "border-line-strong/50 text-muted",
          },
        ]
      : []),
    ...(d?.budget.overall
      ? [
          {
            value: d.budget.overall.limit,
            label: "Budget",
            className: "border-danger/60 text-danger",
          },
        ]
      : []),
  ];
  const investBars: Bar[] = all.map((m) => ({
    month: m.month,
    value: m.invested,
    current: m === d?.current,
    sub: m.income > 0 ? pct(m.invested / m.income) : undefined,
  }));
  const investLines: RefLine[] = d?.investing.usualAmount
    ? [
        {
          value: d.investing.usualAmount,
          label: "Usual",
          className: "border-line-strong/50 text-muted",
        },
      ]
    : [];

  return (
    <div className="flex flex-col gap-8">
      <MonthSwitcher />
      <div
        aria-busy={q.isPlaceholderData}
        className={cx(
          "flex flex-col gap-12 transition-opacity duration-300",
          q.isPlaceholderData && "pointer-events-none opacity-35",
        )}
      >
        <section className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div>
              <Label>
                {d && d.history.length > 0
                  ? `Compared with ${shortMonth(d.history[0]?.month ?? "")}–${shortMonth(d.history.at(-1)?.month ?? "")}`
                  : "This month"}
              </Label>
              <h1 className="mt-2 text-[56px] font-bold leading-[0.9] tracking-[-0.06em] sm:text-[80px]">
                Analytics
              </h1>
            </div>
            <fieldset className="flex gap-[3px] rounded-[10px] border-2 border-line p-[3px]">
              <legend className="sr-only">Compare with the last</legend>
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
            </fieldset>
          </div>
          {d ? <AnswerCards items={answers(d, money)} /> : <Skeleton className="h-[118px]" />}
        </section>

        {q.isPending ? (
          <Skeleton className="h-[420px]" />
        ) : q.data?.rows.length === 0 ? (
          <EmptyState
            title="Nothing to analyse yet"
            hint="This page fills in as you log expenses, income and investments."
            action={<Button onClick={() => openNew()}>Add expense</Button>}
          />
        ) : (
          d && (
            <>
              {actions.length > 0 && (
                <Reveal>
                  <section aria-label="What to do" className="flex flex-col gap-4">
                    <h2 className="border-b-2 border-line-strong pb-2 text-sm font-bold uppercase tracking-[0.12em]">
                      What to do
                    </h2>
                    <ActionList actions={actions} />
                  </section>
                </Reveal>
              )}

              <Reveal className="grid gap-x-12 gap-y-12 lg:grid-cols-[3fr_2fr]">
                <Question
                  id="spending"
                  title="Am I spending more or less?"
                  note="Spending per month"
                  answer={spendingAnswer(d, money)}
                >
                  <MonthBars bars={spendBars} lines={spendLines} verb="spent" />
                </Question>
                <Question
                  id="changes"
                  title="What changed"
                  note={d.history.length ? "vs last 3 months, same point" : undefined}
                  answer={
                    d.history.length === 0
                      ? "Shows up once there's an earlier month to compare with."
                      : d.spending.movers.length
                        ? "The categories that moved the most."
                        : "Nothing unusual."
                  }
                >
                  <Movers d={d} byId={byId} />
                </Question>
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-12 lg:grid-cols-[3fr_2fr]">
                <Question
                  id="investing"
                  title="Am I investing enough?"
                  note="Invested · % of income"
                  answer={investingAnswer(d, money)}
                >
                  <MonthBars bars={investBars} lines={investLines} verb="invested" />
                </Question>
                <Question
                  id="regularity"
                  title="Am I investing regularly?"
                  answer={regularityAnswer(d)}
                >
                  <InvestStrip d={d} />
                </Question>
              </Reveal>

              <Reveal>
                <Question
                  id="cashflow"
                  title="Am I living within my income?"
                  answer={cashflowAnswer(d, money)}
                >
                  <CashflowTable rows={all} running={d.running} />
                </Question>
              </Reveal>

              <Reveal>
                <Question id="plan" title="Am I sticking to my plan?" answer={planAnswer(d, money)}>
                  <BudgetPlan d={d} byId={byId} />
                </Question>
              </Reveal>
            </>
          )
        )}
      </div>
    </div>
  );
}
