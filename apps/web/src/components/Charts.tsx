import { daysInMonth, monthTitle } from "@money/shared";
import { motion } from "motion/react";
import { useState } from "react";
import { useMoney } from "../lib/hooks";
import type { TrendMonth } from "../lib/queries";
import { cx } from "./ui";

const CHART_H = 140;

/** Short month name, e.g. "2026-11" → "Nov". */
const shortMonth = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleString("en", { month: "short" });

/** A floating label over the hovered bar. Text uses text tokens, never the series color. */
function Tip({ left, children }: { left: string; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-sm shadow-xl"
      style={{ left }}
    >
      {children}
    </div>
  );
}

/**
 * One bar per day of the month. Today is lime, days still ahead are short
 * ghost stubs, the biggest day is labelled, and a dashed line marks the daily
 * pace that would land exactly on the overall budget.
 */
export function DailyBars({
  month,
  totals,
  todayDate,
  dailyBudget,
}: {
  month: string;
  /** Expense total per date (YYYY-MM-DD). */
  totals: Map<string, number>;
  todayDate: string;
  dailyBudget?: number;
}) {
  const money = useMoney();
  const [hover, setHover] = useState<number | null>(null);
  const n = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const days = Array.from({ length: n }, (_, i) => {
    const date = `${month}-${String(i + 1).padStart(2, "0")}`;
    return { day: i + 1, date, total: totals.get(date) ?? 0, future: date > todayDate };
  });
  const peak = days.reduce((best, d) => (d.total > best.total ? d : best));
  const max = Math.max(peak.total, dailyBudget ?? 0, 1);
  const hovered = hover === null ? undefined : days[hover];
  const h = (v: number) => (v / max) * CHART_H;
  const pct = (i: number) => `${((i + 0.5) / n) * 100}%`;

  const spentDays = days.filter((d) => d.total > 0);
  const summary =
    spentDays.length === 0
      ? "No spending yet this month"
      : `Daily spending. Biggest day ${peak.day} ${monthTitle(month)}, ${money(peak.total)}. Spent on ${spentDays.length} of ${n} days.`;

  return (
    <figure className="m-0">
      <div className="relative" style={{ height: CHART_H + 24 }}>
        {/* Bars sit on a shared baseline; label row underneath. */}
        <div
          role="img"
          aria-label={summary}
          className="absolute inset-x-0 top-6 flex items-end gap-[2px]"
          style={{ height: CHART_H }}
          onMouseLeave={() => setHover(null)}
        >
          {days.map((d, i) => (
            <div
              key={d.date}
              className="flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setHover(i)}
            >
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: d.future ? 4 : d.total > 0 ? Math.max(h(d.total), 4) : 2 }}
                transition={{ type: "spring", stiffness: 300, damping: 26, delay: i * 0.012 }}
                className={cx(
                  "w-full rounded-t-[4px] transition-colors",
                  d.future
                    ? "bg-surface"
                    : d.date === todayDate
                      ? "bg-accent"
                      : hover === i
                        ? "bg-ink"
                        : "bg-ink/70",
                )}
              />
            </div>
          ))}
          {dailyBudget !== undefined && dailyBudget > 0 && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-muted/60"
              style={{ bottom: h(dailyBudget) }}
            >
              <span className="absolute -top-6 right-0 text-xs font-semibold text-muted">
                Budget pace {money(dailyBudget)}/day
              </span>
            </div>
          )}
        </div>

        {peak.total > 0 && hover === null && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 whitespace-nowrap text-xs font-bold"
            style={{ left: pct(peak.day - 1), top: 24 + CHART_H - h(peak.total) - 20 }}
          >
            {money(peak.total)}
          </span>
        )}
        {hovered && hover !== null && (
          <Tip left={pct(hover)}>
            <span className="text-muted">
              {hovered.day} {shortMonth(month)}
            </span>{" "}
            <strong>{hovered.future ? "Ahead" : money(hovered.total)}</strong>
          </Tip>
        )}
      </div>
      <div className="relative mt-2 h-4 text-xs font-semibold text-muted">
        {[1, Math.ceil(n / 2), n].map((day) => (
          <span key={day} className="absolute -translate-x-1/2" style={{ left: pct(day - 1) }}>
            {day}
          </span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Six months of spending, one bar each, labelled directly with the amount.
 * The month being viewed is lime. Clicking a bar jumps to that month.
 */
export function MonthTrend({
  months,
  current,
  onPick,
}: {
  months: TrendMonth[];
  current: string;
  onPick: (month: string) => void;
}) {
  const money = useMoney();
  const max = Math.max(...months.map((m) => m.spent), 1);
  const H = CHART_H - 20;

  return (
    <figure className="m-0">
      <ul className="flex items-end gap-2" style={{ height: CHART_H + 24 }}>
        {months.map((m, idx) => {
          const selected = m.month === current;
          return (
            <li key={m.month} className="flex h-full flex-1 flex-col justify-end">
              <button
                type="button"
                onClick={() => onPick(m.month)}
                aria-label={`${monthTitle(m.month)}: spent ${money(m.spent)}`}
                aria-current={selected ? "date" : undefined}
                className="group flex h-full cursor-pointer flex-col items-stretch justify-end gap-1.5 rounded-md"
              >
                <span
                  className={cx(
                    "truncate text-center text-xs font-bold",
                    selected ? "text-ink" : "text-muted group-hover:text-ink",
                  )}
                >
                  {m.spent > 0 ? money(m.spent) : "–"}
                </span>
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: m.spent > 0 ? Math.max((m.spent / max) * H, 4) : 2 }}
                  transition={{ type: "spring", stiffness: 260, damping: 22, delay: idx * 0.05 }}
                  className={cx(
                    "block w-full rounded-t-[4px] transition-colors",
                    selected ? "bg-accent" : "bg-surface-strong group-hover:bg-ink/50",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>
      <ul className="mt-2 flex gap-2 text-xs font-semibold text-muted">
        {months.map((m) => (
          <li
            key={m.month}
            className={cx("flex-1 text-center", m.month === current && "font-bold text-ink")}
          >
            {shortMonth(m.month)}
          </li>
        ))}
      </ul>
    </figure>
  );
}

export interface Stat {
  label: string;
  value: string;
  hint?: string;
  tone?: "danger" | "accent";
}

/** A row of small numbers that explain the hero figure. */
export function StatStrip({ stats }: { stats: Stat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border-2 border-line bg-line md:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-1 bg-bg p-4">
          <dt className="text-[13px] font-bold uppercase tracking-[0.12em] text-muted">
            {s.label}
          </dt>
          <dd
            className={cx(
              "text-2xl font-bold tracking-[-0.02em]",
              s.tone === "danger" && "text-danger",
              s.tone === "accent" && "text-accent",
            )}
          >
            {s.value}
          </dd>
          {s.hint && <dd className="text-sm text-muted">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
