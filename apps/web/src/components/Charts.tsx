import { daysInMonth, monthTitle } from "@money/shared";
import { motion } from "motion/react";
import { useState } from "react";
import { useMoney } from "../lib/hooks";
import { tween } from "./motion";
import { cx } from "./ui";

const CHART_H = 140;

/** Short month name, e.g. "2026-11" → "Nov". */
const shortMonth = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleString("en", { month: "short" });

/**
 * Six months of spending, one bar each, labelled directly with the amount.
 * The month being viewed is lime. Clicking a bar jumps to that month.
 */
export function MonthTrend({
  months,
  current,
  onPick,
  verb = "spent",
}: {
  months: { month: string; value: number }[];
  current: string;
  onPick: (month: string) => void;
  /** Read out by screen readers: "May 2026: spent ₹40,000". */
  verb?: string;
}) {
  const money = useMoney();
  const max = Math.max(...months.map((m) => m.value), 1);
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
                aria-label={`${monthTitle(m.month)}: ${verb} ${money(m.value)}`}
                aria-current={selected ? "date" : undefined}
                className="group flex h-full cursor-pointer flex-col items-stretch justify-end gap-1.5 rounded-md"
              >
                <span
                  className={cx(
                    "truncate text-center text-xs font-bold",
                    selected ? "text-ink" : "text-muted group-hover:text-ink",
                  )}
                >
                  {m.value > 0 ? money(m.value) : "–"}
                </span>
                <motion.span
                  initial={{ height: 0 }}
                  animate={{ height: m.value > 0 ? Math.max((m.value / max) * H, 4) : 2 }}
                  transition={{ ...tween.slow, delay: idx * 0.05 }}
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
