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

type Tone = "warn" | "good" | "info";
const toneText: Record<Tone, string> = { warn: "text-danger", good: "text-accent", info: "" };

// ── Answer cards ────────────────────────────────────────────────────────────

interface Answer {
  question: string;
  value: string;
  detail: string;
  tone: Tone;
  href: string;
}

/** The four questions, answered in a word or a number. Each card jumps to its section. */
export function answers(d: Decisions, money: (m: number) => string): Answer[] {
  const early = d.confidence === "early" ? " · early read" : "";
  const s = d.spending;
  const u = s.usualByNow;
  const spend: Answer = u
    ? {
        question: "Flexible spending",
        value: { above: "Above usual", below: "Below usual", within: "Usual" }[
          s.verdict ?? "within"
        ],
        detail: `${money(d.current.flexible)} · usually ${u.low === u.high ? money(u.mid) : `${compactMoney(u.low)}–${compactMoney(u.high)}`}${d.running ? " by now" : ""}${early}`,
        // Never praise spending when logging is thin: missing entries look like saving.
        tone:
          s.verdict === "above"
            ? "warn"
            : s.verdict === "below" && !d.logging.thin
              ? "good"
              : "info",
        href: "#spending",
      }
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
          ? `of income · usually ${pct(inv.usualRate)}${early}`
          : "of income",
    tone:
      inv.rate === null || inv.usualRate === null
        ? "info"
        : inv.rate >= inv.usualRate
          ? "good"
          : "warn",
    href: "#investing",
  };

  const c = d.consistency;
  const missed = c.months.filter((m) => m.invested === 0).map((m) => shortMonth(m.month));
  const regular: Answer = {
    question: "Investing regularity",
    value: c.steadiness === "early" ? "Too early" : `${c.investedMonths} of ${c.months.length}`,
    detail: {
      steady: "months · steady",
      uneven: "months · amounts swing a lot",
      irregular: `months · missed ${missed.slice(-3).join(", ")}`,
      none: "months · nothing invested",
      early: "needs another month",
    }[c.steadiness],
    tone: c.steadiness === "steady" ? "good" : c.steadiness === "early" ? "info" : "warn",
    href: "#regularity",
  };

  const o = d.budget.overall;
  const over = o && d.current.spent > o.limit;
  const overPace = o && d.running && d.elapsed >= 7 && s.projected.mid > o.limit;
  const budget: Answer = o
    ? {
        question: "Budget",
        value: over ? "Over" : overPace ? "Over pace" : "On track",
        detail: `${money(d.current.spent)} of ${money(o.limit)}`,
        tone: over || overPace ? "warn" : d.logging.thin ? "info" : "good",
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

const actionDot: Record<Tone, string> = { warn: "bg-danger", good: "bg-accent", info: "bg-muted" };

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
  /** Stacked bottom to top. The total is labelled above the bar. */
  parts: { value: number; className: string }[];
  /** Outline above the bar: where a running month is likely to end. */
  projected?: number;
  /** A second line under the month name, e.g. "43%". */
  sub?: string;
  current?: boolean;
}

const BARS_H = 150;

/**
 * One bar per month, labelled directly. Optionally a shaded band for the usual range
 * and a line for a limit. Kept to those few marks so it reads at a glance.
 */
export function MonthBars({
  bars,
  band,
  limit,
  verb,
  legend,
}: {
  bars: Bar[];
  band?: { low: number; high: number } | null;
  limit?: number | null;
  /** For screen readers: "Oct: spent ₹40,000". */
  verb: string;
  legend?: ReactNode;
}) {
  const money = useMoney();
  const total = (b: Bar) => b.parts.reduce((t, p) => t + p.value, 0);
  const max = Math.max(
    1,
    ...bars.map((b) => Math.max(total(b), b.projected ?? 0)),
    band?.high ?? 0,
    limit ?? 0,
  );
  const h = (v: number) => (v / max) * BARS_H;

  return (
    <figure className="m-0 flex flex-col gap-2">
      <div className="relative" style={{ height: BARS_H + 20 }}>
        {band && (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 bg-ink/[0.07]"
            style={{ bottom: h(band.low), height: Math.max(2, h(band.high) - h(band.low)) }}
          />
        )}
        {limit ? (
          <div
            aria-hidden="true"
            className="absolute inset-x-0 border-t-2 border-dashed border-danger/70"
            style={{ bottom: h(limit) }}
          />
        ) : null}
        <ul className="absolute inset-0 flex items-end gap-1.5 sm:gap-2">
          {bars.map((b) => {
            const value = total(b);
            const ghost = b.projected && b.projected > value ? b.projected : 0;
            return (
              <li
                key={b.month}
                className="flex h-full min-w-0 flex-1 flex-col items-stretch justify-end"
                aria-label={`${shortMonth(b.month)}: ${verb} ${money(value)}${ghost ? `, likely ${money(ghost)} by month end` : ""}`}
              >
                <span
                  className={cx(
                    "mb-1 truncate text-center text-[11px] font-bold sm:text-xs",
                    b.current ? "text-ink" : "text-muted",
                  )}
                >
                  {value > 0 ? compactMoney(value) : "–"}
                </span>
                {ghost > 0 && (
                  <span
                    className="block rounded-t-[4px] border-2 border-b-0 border-dashed border-line-strong/50"
                    style={{ height: h(ghost - value) }}
                  />
                )}
                <div
                  className={cx(
                    "flex flex-col-reverse overflow-hidden",
                    !ghost && "rounded-t-[4px]",
                  )}
                >
                  {b.parts.map((p, i) => (
                    <span
                      key={i}
                      className={cx("block w-full", p.className)}
                      style={{ height: p.value > 0 ? Math.max(h(p.value), 2) : 0 }}
                    />
                  ))}
                </div>
                {value === 0 && <span className="block h-px w-full bg-line-strong/30" />}
              </li>
            );
          })}
        </ul>
      </div>
      <ul className="flex gap-1.5 text-xs font-semibold text-muted sm:gap-2">
        {bars.map((b) => (
          <li key={b.month} className={cx("min-w-0 flex-1 text-center", b.current && "text-ink")}>
            <span className="block truncate">{shortMonth(b.month)}</span>
            {b.sub && <span className="block truncate font-normal text-faint">{b.sub}</span>}
          </li>
        ))}
      </ul>
      {legend && (
        <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {legend}
        </figcaption>
      )}
    </figure>
  );
}

/** One legend entry: a small swatch and a word. */
export function Key({ swatch, children }: { swatch: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden="true" className={cx("inline-block h-2.5 w-3.5 rounded-sm", swatch)} />
      {children}
    </span>
  );
}

// ── What changed ────────────────────────────────────────────────────────────

/** Flexible categories that moved most against recent months, as plain rows. */
export function Movers({ d, byId }: { d: Decisions; byId: Map<string, Category> }) {
  const money = useMoney();
  if (d.spending.movers.length === 0) return null;
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
  if (months.length === 0) return null;
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
  const cell = (v: number) => (v ? money(v) : "–");
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[28rem] border-collapse text-right tabular-nums">
        <thead>
          <tr className="border-b-2 border-line-strong text-[13px] uppercase tracking-[0.1em] text-muted">
            <th className="py-2 text-left font-bold">Month</th>
            <th className="py-2 font-bold">Earned</th>
            <th className="py-2 font-bold">Spent</th>
            <th className="py-2 font-bold">Invested</th>
            <th className="py-2 font-bold">Left</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.month} className={cx("border-b border-line", i === last && "font-semibold")}>
              <td className="py-2.5 text-left">
                {shortMonth(r.month)}
                {i === last && running && <span className="ml-1.5 text-xs text-muted">so far</span>}
              </td>
              <td className="py-2.5">{cell(r.income)}</td>
              <td className="py-2.5">{cell(r.spent)}</td>
              <td className="py-2.5 text-accent">{cell(r.invested)}</td>
              <td className={cx("py-2.5", r.left < 0 && "text-danger")}>
                {r.left < 0 ? "−" : ""}
                {money(Math.abs(r.left))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Plan ────────────────────────────────────────────────────────────────────

/** Spent vs a limit, with a tick where an even pace would be today and an outline to the likely end. */
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
  return (
    <div className="relative h-3 rounded-full bg-surface">
      {projected > spent && (
        <span
          className="absolute inset-y-0 left-0 rounded-full border-2 border-dashed border-line-strong/40"
          style={{ width: w(projected) }}
        />
      )}
      <span
        className={cx(
          "absolute inset-y-0 left-0 rounded-full",
          spent > limit ? "bg-danger" : "bg-accent",
        )}
        style={{ width: w(spent) }}
      />
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
    <div className="flex flex-col gap-5">
      {o ? (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4">
            <span className="font-semibold">All spending</span>
            <span className="text-sm text-muted">
              {money(d.current.spent)} of {money(o.limit)}
            </span>
          </div>
          <PaceBar
            spent={d.current.spent}
            limit={o.limit}
            projected={d.running ? d.spending.projected.mid : d.current.spent}
            expected={even(o.limit)}
          />
          {o.counted > 0 && (
            <p className="text-sm text-muted">
              Within budget in {o.within} of the last {o.counted}{" "}
              {o.counted === 1 ? "month" : "months"}.
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-dashed border-line-strong/30 p-4">
          <p className="text-[15px]">
            No monthly budget yet.
            {d.budget.suggested !== null &&
              ` ${money(d.budget.suggested)} would cover a normal month for you.`}
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
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-3 w-0.5 rounded bg-muted" />
            even pace today
          </span>
          <Key swatch="border-2 border-dashed border-line-strong/40">likely month end</Key>
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
  children,
}: {
  id: string;
  title: string;
  answer: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section id={id} aria-label={title} className="flex min-w-0 scroll-mt-6 flex-col gap-4">
      <h2 className="border-b-2 border-line-strong pb-2 text-sm font-bold uppercase tracking-[0.12em]">
        {title}
      </h2>
      <p className="text-xl font-bold tracking-[-0.02em] text-balance sm:text-2xl">{answer}</p>
      {children}
    </section>
  );
}
