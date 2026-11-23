// The Analytics page's building blocks: each answers one question about your money.
// Deliberately plain (bars, rows, a table) so the numbers do the talking.
import type { Action, Decisions, MonthTotals } from "@money/shared";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { catTint, cx } from "../ui";
import { compactMoney, shortMonth } from "./frame";

const pct = (r: number) => `${Math.round(r * 100)}%`;
const signedPct = (r: number) => `${r >= 0 ? "+" : "−"}${Math.abs(Math.round(r * 100))}%`;

type Tone = "warn" | "good" | "info";
const toneText: Record<Tone, string> = {
  warn: "text-danger",
  good: "text-accent",
  info: "",
};

// ── Answer cards ────────────────────────────────────────────────────────────

interface Answer {
  question: string;
  value: string;
  detail: string;
  tone: Tone;
  href: string;
}

/** The four questions, answered in one number each. Each card jumps to its section. */
export function answers(d: Decisions, money: (m: number) => string): Answer[] {
  const s = d.spending;
  const spend: Answer =
    s.usualByNow && s.usualByNow > 0
      ? (() => {
          const r = d.current.spent / s.usualByNow - 1;
          return {
            question: "Spending vs usual",
            value: Math.abs(r) < 0.05 ? "About usual" : signedPct(r),
            detail: `${money(d.current.spent)} so far · usually ${money(s.usualByNow)}${d.running ? " by now" : ""}`,
            tone: r > 0.1 ? "warn" : r < -0.05 ? "good" : "info",
            href: "#spending",
          };
        })()
      : {
          question: "Spending",
          value: money(d.current.spent),
          detail: d.running ? "so far · nothing to compare yet" : "nothing earlier to compare",
          tone: "info",
          href: "#spending",
        };

  const inv = d.investing;
  const invest: Answer = {
    question: "Invested",
    value: inv.rate !== null ? pct(inv.rate) : money(d.current.invested),
    detail:
      inv.rate === null
        ? "no income logged this month"
        : inv.usualRate !== null
          ? `of income · usually ${pct(inv.usualRate)}`
          : "of income",
    tone:
      inv.rate === null
        ? "info"
        : inv.usualRate !== null
          ? inv.rate >= inv.usualRate
            ? "good"
            : "warn"
          : inv.rate >= 0.2
            ? "good"
            : "info",
    href: "#investing",
  };

  const c = d.consistency;
  const missed = c.months.filter((m) => m.invested === 0).map((m) => shortMonth(m.month));
  const regular: Answer = {
    question: "Investing regularity",
    value: c.months.length ? `${c.investedMonths} of ${c.months.length}` : "–",
    detail: {
      steady: "months · steady",
      uneven: "months · amounts swing a lot",
      irregular: `months · missed ${missed.slice(-3).join(", ")}`,
      none: "months · nothing invested",
      early: "too early to tell",
    }[c.steadiness],
    tone: c.steadiness === "steady" ? "good" : c.steadiness === "early" ? "info" : "warn",
    href: "#regularity",
  };

  const o = d.budget.overall;
  const budget: Answer = o
    ? {
        question: "Budget",
        value:
          d.current.spent > o.limit
            ? "Over"
            : d.running && s.projected > o.limit
              ? "Over pace"
              : "On track",
        detail: `${money(d.current.spent)} of ${money(o.limit)}${d.running ? ` · ~${money(s.projected)} by month end` : ""}`,
        tone: d.current.spent > o.limit || (d.running && s.projected > o.limit) ? "warn" : "good",
        href: "#plan",
      }
    : {
        question: "Budget",
        value: "Not set",
        detail: d.budget.suggested
          ? `try ${money(d.budget.suggested)} a month`
          : "set one to track it",
        tone: "info",
        href: "#plan",
      };

  return [spend, invest, regular, budget];
}

export function AnswerCards({ items }: { items: Answer[] }) {
  return (
    <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border-2 border-line bg-line lg:grid-cols-4">
      {items.map((a) => (
        <li key={a.question} className="bg-bg">
          <a
            href={a.href}
            className="flex h-full flex-col gap-1 p-4 transition-colors hover:bg-surface/60"
          >
            <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
              {a.question}
            </span>
            <span className={cx("text-2xl font-bold tracking-[-0.02em]", toneText[a.tone])}>
              {a.value}
            </span>
            <span className="text-sm text-muted">{a.detail}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

// ── What to do ──────────────────────────────────────────────────────────────

const actionDot: Record<Tone, string> = {
  warn: "bg-danger",
  good: "bg-accent",
  info: "bg-muted",
};

export function ActionList({ actions }: { actions: Action[] }) {
  if (actions.length === 0) return null;
  return (
    <ol className="flex flex-col gap-2">
      {actions.map((a) => (
        <li
          key={a.id}
          className="flex items-start gap-3 rounded-xl border-2 border-line px-4 py-3 text-[15px] leading-snug"
        >
          <span
            aria-hidden="true"
            className={cx("mt-1.5 size-2.5 shrink-0 rounded-full", actionDot[a.tone])}
          />
          <span>{a.text}</span>
        </li>
      ))}
    </ol>
  );
}

// ── Month bars ──────────────────────────────────────────────────────────────

export interface Bar {
  month: string;
  value: number;
  /** Drawn as an outline above the bar: where a running month is likely to end. */
  projected?: number;
  /** A second line under the month name, e.g. "43%". */
  sub?: string;
  current?: boolean;
}

export interface RefLine {
  value: number;
  label: string;
  className: string;
}

const BARS_H = 150;

/** One bar per month, labelled directly, with optional reference lines (average, budget). */
export function MonthBars({
  bars,
  lines = [],
  verb,
}: {
  bars: Bar[];
  lines?: RefLine[];
  /** For screen readers: "Oct: spent ₹40,000". */
  verb: string;
}) {
  const money = useMoney();
  const max = Math.max(
    1,
    ...bars.map((b) => Math.max(b.value, b.projected ?? 0)),
    ...lines.map((l) => l.value),
  );
  const h = (v: number) => (v / max) * BARS_H;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height: BARS_H + 22 }}>
        {lines.map((l) => (
          <div
            key={l.label}
            aria-hidden="true"
            className={cx("absolute inset-x-0 border-t-2 border-dashed", l.className)}
            style={{ bottom: h(l.value) }}
          >
            <span className="absolute right-0 -top-5 bg-bg pl-1.5 text-xs font-semibold">
              {l.label} {compactMoney(l.value)}
            </span>
          </div>
        ))}
        <ul className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
          {bars.map((b) => {
            const ghost = b.projected && b.projected > b.value ? b.projected : 0;
            return (
              <li
                key={b.month}
                className="flex h-full min-w-0 flex-1 flex-col items-stretch justify-end"
                aria-label={`${shortMonth(b.month)}: ${verb} ${money(b.value)}${ghost ? `, heading for ${money(ghost)}` : ""}`}
              >
                <span
                  className={cx(
                    "mb-1 truncate text-center text-[11px] font-bold sm:text-xs",
                    b.current ? "text-ink" : "text-muted",
                  )}
                >
                  {b.value > 0 ? compactMoney(b.value) : "–"}
                </span>
                <div
                  className="relative flex flex-col justify-end"
                  style={{ height: h(Math.max(b.value, ghost)) }}
                >
                  {ghost > 0 && (
                    <span
                      className="absolute inset-x-0 top-0 rounded-t-[4px] border-2 border-b-0 border-dashed border-accent/60"
                      style={{ height: h(ghost - b.value) }}
                    />
                  )}
                  <span
                    className={cx(
                      "block w-full rounded-t-[4px]",
                      ghost > 0 && "rounded-t-none",
                      b.current ? "bg-accent" : "bg-surface-strong",
                    )}
                    style={{ height: Math.max(h(b.value), b.value > 0 ? 3 : 1) }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="mt-2 flex gap-1.5 text-xs font-semibold text-muted sm:gap-2">
        {bars.map((b) => (
          <li key={b.month} className={cx("min-w-0 flex-1 text-center", b.current && "text-ink")}>
            <span className="block truncate">{shortMonth(b.month)}</span>
            {b.sub && <span className="block truncate font-normal text-faint">{b.sub}</span>}
          </li>
        ))}
      </ul>
    </figure>
  );
}

// ── What changed ────────────────────────────────────────────────────────────

/** Categories that moved most against recent months, as plain rows. */
export function Movers({ d, byId }: { d: Decisions; byId: Map<string, Category> }) {
  const money = useMoney();
  if (d.history.length === 0) return null;
  if (d.spending.movers.length === 0)
    return <p className="text-muted">No category is far from its usual level.</p>;
  return (
    <ul className="flex flex-col">
      {d.spending.movers.map((m) => {
        const cat = byId.get(m.key);
        const up = m.diff > 0;
        return (
          <li key={m.key} className="flex items-center gap-3.5 border-b border-line py-2.5">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl border-[1.5px] text-lg"
              style={catTint(cat?.color ?? "slate")}
            >
              {cat?.emoji ?? "?"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{cat?.name ?? "Unknown"}</span>
              <span className="block truncate text-[13px] text-muted">
                {money(m.now)} · usually {money(m.usual)}
              </span>
            </span>
            <span className={cx("shrink-0 font-bold", up ? "text-danger" : "text-success")}>
              {up ? "+" : "−"}
              {money(Math.abs(m.diff))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Regularity ──────────────────────────────────────────────────────────────

/** One cell per month: invested (with the amount) or missed. */
export function InvestStrip({ d }: { d: Decisions }) {
  const months = d.consistency.months;
  if (months.length === 0) return <p className="text-muted">Nothing to show yet.</p>;
  return (
    <ul
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${Math.min(months.length, 12)}, minmax(0, 1fr))` }}
    >
      {months.map((m) => {
        const hit = m.invested > 0;
        return (
          <li
            key={m.month}
            aria-label={`${shortMonth(m.month)}: ${hit ? `invested ${compactMoney(m.invested)}` : "nothing invested"}`}
            className={cx(
              "flex flex-col items-center gap-0.5 rounded-lg border-2 py-2.5",
              hit ? "border-accent/50 bg-accent/10" : "border-dashed border-line-strong/30",
            )}
          >
            <span className={cx("text-xs font-bold", hit ? "text-ink" : "text-muted")}>
              {shortMonth(m.month)}
            </span>
            <span className={cx("truncate text-[11px]", hit ? "text-accent" : "text-faint")}>
              {hit ? compactMoney(m.invested) : "missed"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Cash flow ───────────────────────────────────────────────────────────────

/** Earned, spent, invested and what was left, month by month. */
export function CashflowTable({ rows, running }: { rows: MonthTotals[]; running: boolean }) {
  const money = useMoney();
  const last = rows.length - 1;
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[32rem] border-collapse text-right tabular-nums">
        <thead>
          <tr className="border-b-2 border-line-strong text-[13px] font-bold uppercase tracking-[0.1em] text-muted">
            <th className="py-2 text-left font-bold">Month</th>
            <th className="py-2 font-bold">Earned</th>
            <th className="py-2 font-bold">Spent</th>
            <th className="py-2 font-bold">Invested</th>
            <th className="py-2 font-bold">Left</th>
            <th
              className="py-2 font-bold"
              title="Share of income not spent (invested or left over)"
            >
              Kept
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const kept = r.income > 0 ? (r.income - r.spent) / r.income : null;
            return (
              <tr
                key={r.month}
                className={cx("border-b border-line", i === last && "font-semibold")}
              >
                <td className="py-2.5 text-left">
                  {shortMonth(r.month)}
                  {i === last && running && (
                    <span className="ml-1.5 text-xs text-muted">so far</span>
                  )}
                </td>
                <td className="py-2.5">{r.income ? money(r.income) : "–"}</td>
                <td className="py-2.5">{r.spent ? money(r.spent) : "–"}</td>
                <td className="py-2.5 text-accent">{r.invested ? money(r.invested) : "–"}</td>
                <td className={cx("py-2.5", r.left < 0 && "text-danger")}>
                  {r.left < 0 ? "−" : ""}
                  {money(Math.abs(r.left))}
                </td>
                <td className={cx("py-2.5", kept !== null && kept < 0 && "text-danger")}>
                  {kept === null ? "–" : pct(kept)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Plan ────────────────────────────────────────────────────────────────────

/** Spent vs a limit, with a tick where an even pace would be today and an outline to the projection. */
function PaceBar({
  spent,
  limit,
  projected,
  expected,
}: {
  spent: number;
  limit: number;
  projected: number;
  expected: number | null;
}) {
  const scale = Math.max(limit, spent, projected);
  const w = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  const over = spent > limit;
  return (
    <div className="relative h-3 rounded-full bg-surface">
      {projected > spent && (
        <span
          className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-line-strong/40"
          style={{ width: w(projected) }}
        />
      )}
      <span
        className={cx("absolute inset-y-0 left-0 rounded-full", over ? "bg-danger" : "bg-accent")}
        style={{ width: w(spent) }}
      />
      {/* The limit, when the scale runs past it. */}
      {scale > limit && (
        <span className="absolute -inset-y-1 w-0.5 bg-ink" style={{ left: w(limit) }} />
      )}
      {expected !== null && (
        <span
          title="Where an even pace would be today"
          className="absolute -inset-y-1.5 w-0.5 rounded bg-muted"
          style={{ left: w(expected) }}
        />
      )}
    </div>
  );
}

export function BudgetPlan({ d, byId }: { d: Decisions; byId: Map<string, Category> }) {
  const money = useMoney();
  const o = d.budget.overall;
  const even = (limit: number) => (d.running ? Math.round((limit * d.elapsed) / d.days) : null);

  return (
    <div className="flex flex-col gap-6">
      {o ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-semibold">Monthly budget</span>
            <span className="text-sm text-muted">
              {money(d.current.spent)} of {money(o.limit)}
              {d.running && ` · heading for ${money(d.spending.projected)}`}
            </span>
          </div>
          <PaceBar
            spent={d.current.spent}
            limit={o.limit}
            projected={d.running ? d.spending.projected : d.current.spent}
            expected={even(o.limit)}
          />
          {o.counted > 0 && (
            <p className="text-sm text-muted">
              Stayed within it in {o.within} of the last {o.counted}{" "}
              {o.counted === 1 ? "month" : "months"}.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-line-strong/30 p-4">
          <p className="text-[15px]">
            No monthly budget yet.
            {d.budget.suggested !== null &&
              ` Based on your spending, ${money(d.budget.suggested)} is a realistic start.`}
          </p>
          <Link
            to="/budgets"
            className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-bold text-on-accent"
          >
            Set a budget
          </Link>
        </div>
      )}

      {d.budget.categories.length > 0 && (
        <ul className="flex flex-col gap-4">
          {d.budget.categories.map((b) => {
            const cat = byId.get(b.key);
            return (
              <li key={b.key} className="flex flex-col gap-2">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="font-semibold">
                    <span aria-hidden="true">{cat?.emoji} </span>
                    {cat?.name ?? "Unknown"}
                  </span>
                  <span className={cx("text-sm", b.spent > b.limit ? "text-danger" : "text-muted")}>
                    {money(b.spent)} of {money(b.limit)}
                  </span>
                </div>
                <PaceBar
                  spent={b.spent}
                  limit={b.limit}
                  projected={d.running ? b.projected : b.spent}
                  expected={even(b.limit)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {d.running && (o || d.budget.categories.length > 0) && (
        <p className="flex items-center gap-2 text-[13px] text-faint">
          <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded bg-muted" /> where an
          even pace puts you today
          <span
            aria-hidden="true"
            className="ml-3 inline-block h-2.5 w-5 rounded-full border-2 border-dashed border-line-strong/40"
          />{" "}
          likely month end
        </p>
      )}
    </div>
  );
}

/** A question as a section: the question, a one-line answer, then the evidence. */
export function Question({
  id,
  title,
  answer,
  note,
  children,
}: {
  id: string;
  title: string;
  answer: ReactNode;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="flex min-w-0 scroll-mt-6 flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3 border-b-2 border-line-strong pb-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.12em]">{title}</h2>
        {note && <span className="text-sm text-muted">{note}</span>}
      </div>
      <p className="text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl">{answer}</p>
      {children}
    </section>
  );
}
