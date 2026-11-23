import {
  ANALYTICS_RANGES,
  type AnalyticsRange,
  type Decisions,
  decisionActions,
  decisions,
  today,
} from "@money/shared";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ActionList,
  AnswerCards,
  answers,
  type Bar,
  BudgetPlan,
  CashflowTable,
  InvestStrip,
  Key,
  MonthBars,
  Movers,
  Question,
} from "../../components/analytics/Decisions";
import { compactMoney } from "../../components/analytics/frame";
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

// One sentence per question; the evidence sits underneath.

function spendingAnswer(d: Decisions, money: Money): string {
  const u = d.spending.usualByNow;
  if (!u)
    return `${money(d.current.spent)} spent${d.running ? " so far" : ""}. Nothing earlier to compare with yet.`;
  const when = d.running ? " for this point in the month" : "";
  switch (d.spending.verdict) {
    case "above":
      return `Flexible spending is ${money(d.current.flexible - u.high)} above your usual range${when}.`;
    case "below":
      return `Flexible spending is ${money(u.low - d.current.flexible)} below your usual range${when}.`;
    default:
      return `Flexible spending is within your usual range${when}.`;
  }
}

function investingAnswer(d: Decisions, money: Money): string {
  const { rate, usualRate } = d.investing;
  if (rate === null)
    return d.current.invested > 0
      ? `${money(d.current.invested)} invested. Log income to see the share.`
      : "Nothing invested, and no income logged.";
  const base = `${pct(rate)} of your income went to investments`;
  if (usualRate === null) return `${base}.`;
  return `${base}, ${rate >= usualRate ? "at or above" : "below"} your usual ${pct(usualRate)}.`;
}

function regularityAnswer(d: Decisions): string {
  const c = d.consistency;
  const of = `${c.investedMonths} of the last ${c.months.length} months`;
  switch (c.steadiness) {
    case "early":
      return "Too early to tell. Check back after another month.";
    case "none":
      return `Nothing invested in the last ${c.months.length} months.`;
    case "irregular":
      return `Irregular: you invested in ${of}.`;
    case "uneven":
      return "You invest every month, but the amounts swing a lot.";
    case "steady":
      return `Steady: you invested in ${of}${c.streak > 2 ? `, a ${c.streak}-month streak` : ""}.`;
  }
}

function cashflowAnswer(d: Decisions, money: Money): string {
  const rows = [...d.history, d.current].filter((r) => r.income > 0);
  if (rows.length === 0) return "Log your income to see what's left each month.";
  const short = rows.filter((r) => r.left < 0).length;
  if (short > 0)
    return `In ${short} of ${rows.length} months you spent and invested more than you earned.`;
  return d.current.income > 0
    ? `You live within your income. ${money(d.current.left)} is left unallocated this month.`
    : "You live within your income.";
}

function planAnswer(d: Decisions, money: Money): string {
  const o = d.budget.overall;
  if (!o) return "No budget yet, so there's nothing to measure against.";
  if (d.current.spent > o.limit) return `${money(d.current.spent - o.limit)} over budget.`;
  if (!d.running) return `Within budget, with ${money(o.limit - d.current.spent)} to spare.`;
  if (d.elapsed < 7) return "Too early in the month to call. Check back after the first week.";
  const p = d.spending.projected;
  return p.mid > o.limit
    ? `Likely to finish about ${money(p.mid - o.limit)} over budget.`
    : `On track, with about ${money(o.limit - p.mid)} to spare.`;
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
  const actions = useMemo(
    () => (d ? decisionActions(d, money, (id) => byId.get(id)?.name ?? "A category") : []),
    [d, money, byId],
  );

  const all = d ? [...d.history, d.current] : [];
  const isNow = (m: { month: string }) => m.month === d?.month;
  const spendBars: Bar[] = all.map((m) => ({
    month: m.month,
    parts: [
      { value: m.fixed, className: "bg-line-strong/30" },
      { value: m.flexible, className: isNow(m) ? "bg-accent" : "bg-ink/55" },
    ],
    current: isNow(m),
    projected: isNow(m) && d?.running ? d.spending.projected.mid : undefined,
  }));
  const investBars: Bar[] = all.map((m) => ({
    month: m.month,
    parts: [{ value: m.invested, className: isNow(m) ? "bg-accent" : "bg-ink/55" }],
    current: isNow(m),
    sub: m.income > 0 ? pct(m.invested / m.income) : undefined,
  }));
  const usualMonth = d?.spending.usualMonth;

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
                  answer={spendingAnswer(d, money)}
                >
                  <MonthBars
                    bars={spendBars}
                    band={usualMonth && d.confidence !== "none" ? usualMonth : null}
                    limit={d.budget.overall?.limit}
                    verb="spent"
                    legend={
                      <>
                        <Key swatch="bg-line-strong/30">Fixed</Key>
                        <Key swatch="bg-ink/55">Flexible</Key>
                        {usualMonth && d.confidence !== "none" && (
                          <Key swatch="bg-ink/[0.12]">
                            Usual month {compactMoney(usualMonth.low)}–
                            {compactMoney(usualMonth.high)}
                          </Key>
                        )}
                        {d.budget.overall && (
                          <Key swatch="border-t-2 border-dashed border-danger/70 h-0">Budget</Key>
                        )}
                      </>
                    }
                  />
                  {!d.hasFixed && (
                    <p className="text-sm text-muted">
                      Rent, EMIs or family support in here?{" "}
                      <Link to="/categories" className="font-semibold text-ink underline">
                        Mark them as fixed
                      </Link>{" "}
                      so they don't count as overspending.
                    </p>
                  )}
                </Question>
                {d.spending.movers.length > 0 && (
                  <Question
                    id="changes"
                    title="What changed"
                    answer="Flexible categories furthest from usual."
                  >
                    <Movers d={d} byId={byId} />
                  </Question>
                )}
              </Reveal>

              <Reveal className="grid gap-x-12 gap-y-12 lg:grid-cols-[3fr_2fr]">
                <Question
                  id="investing"
                  title="Am I investing enough?"
                  answer={investingAnswer(d, money)}
                >
                  <MonthBars
                    bars={investBars}
                    verb="invested"
                    legend={<span>Under each month: share of income invested</span>}
                  />
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
