import { type BudgetState, budgetProgress } from "@money/shared";
import { type ReactNode, useEffect, useState } from "react";
import { useMoney } from "../lib/hooks";
import { PencilIcon } from "./icons";
import { cx } from "./ui";

const STROKE: Record<BudgetState, string> = {
  ok: "stroke-ink",
  warning: "stroke-warning",
  over: "stroke-danger",
};

export const STATE_TEXT: Record<BudgetState, string> = {
  ok: "text-ink",
  warning: "text-warning",
  over: "text-danger",
};

/**
 * A half donut: the arc fills left to right with the share of the budget used, the
 * percentage sits in the bowl (or `children`, in its place). Over budget, the whole arc
 * turns red and a bar underneath grows with the overspend, so 108% and 227% look different.
 * `pace` (0–1) adds a tick where spending would be if it kept exactly to the budget today.
 */
export function HalfRing({
  spent,
  limit,
  width,
  stroke,
  textClass,
  pace,
  children,
}: {
  spent: number;
  limit: number;
  width: number;
  stroke: number;
  /** Size of the percentage, e.g. "text-[22px]". */
  textClass: string;
  pace?: number | null;
  /** Shown in the bowl instead of the percentage. */
  children?: ReactNode;
}) {
  const p = budgetProgress(spent, limit);
  const r = (width - stroke) / 2 - 4;
  const cx0 = width / 2;
  const cy0 = r + stroke / 2 + 4;
  const height = cy0 + stroke / 2 + 2;
  const len = Math.PI * r;
  const target = spent > 0 ? Math.min(1, Math.max(p.ratio, 0.02)) : 0;
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
  const arc = `M ${cx0 - r},${cy0} A ${r} ${r} 0 0 1 ${cx0 + r},${cy0}`;

  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  // The pace tick, across the band at its angle (left end is 0, right end is 1).
  const tick =
    pace != null && pace > 0 && pace < 1
      ? (() => {
          const a = Math.PI * (1 - pace);
          const at = (rad: number) => [cx0 + rad * Math.cos(a), cy0 - rad * Math.sin(a)] as const;
          const [x1, y1] = at(r - stroke / 2 - 4);
          const [x2, y2] = at(r + stroke / 2 + 4);
          return { x1, y1, x2, y2 };
        })()
      : null;
  // Overspend as a share of the limit, capped at one more full budget (200%).
  const overflow = p.state === "over" ? Math.min(Math.max(p.ratio - 1, 0), 1) : 0;
  const pacePct = pace != null ? Math.round(pace * 100) : 0;

  return (
    <div className="flex shrink-0 flex-col items-center gap-2.5" style={{ width }}>
      <div className="relative" style={{ width, height }}>
        <svg width={width} height={height} className="overflow-visible">
          <path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={p.state === "over" ? "stroke-danger/30" : "stroke-surface-strong"}
          />
          <path
            d={arc}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={len}
            strokeDashoffset={len * (1 - shown)}
            className={cx(STROKE[p.state], "transition-[stroke-dashoffset] duration-700 ease-out")}
          />
          {tick && (
            <g>
              <title>{`Should be at ${pacePct}% by today`}</title>
              {/* A wide invisible stroke makes the thin tick easy to hover. */}
              <line {...tick} strokeWidth={14} stroke="transparent" />
              <line {...tick} strokeWidth={5} strokeLinecap="round" className="stroke-bg" />
              <line {...tick} strokeWidth={2.5} strokeLinecap="round" className="stroke-ink" />
            </g>
          )}
        </svg>
        <span
          aria-hidden="true"
          className={cx(
            "absolute inset-x-0 bottom-0 text-center font-bold leading-none tracking-[-0.04em]",
            textClass,
            STATE_TEXT[p.state],
          )}
        >
          {children ?? `${pct}%`}
        </span>
      </div>
      {overflow > 0 && (
        <span
          className="block h-1.5 w-full overflow-hidden rounded-full bg-danger/20"
          title={`${pct - 100}% over the limit`}
        >
          <span
            className="block h-full rounded-full bg-danger transition-[width] duration-700 ease-out"
            style={{ width: `${Math.max(4, overflow * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}

export interface BulletRow {
  key: string;
  name: string;
  spent: number;
  limit: number;
}

const FILL: Record<BudgetState, string> = {
  ok: "bg-ink",
  warning: "bg-warning",
  over: "bg-danger",
};

/**
 * Category budgets as bullet bars on one shared scale: every bar is measured against its
 * own limit, so the limit line sits at the same place on every row. Over budget, the bar
 * runs on past the line in red, so 227% reaches much further than 108%. The tick marks
 * where spending should be by today. Click a row to edit its limit.
 */
export function BudgetBullets({
  rows,
  pace,
  onPick,
}: {
  rows: BulletRow[];
  pace?: number | null;
  onPick?: (row: BulletRow) => void;
}) {
  const money = useMoney();
  // The scale runs a little past the furthest bar, at least to 120% and at most to 250%.
  const top = Math.min(
    2.5,
    Math.max(1.2, ...rows.map((r) => budgetProgress(r.spent, r.limit).ratio * 1.05)),
  );
  const at = (ratio: number) => `${(Math.min(ratio, top) / top) * 100}%`;
  const grid =
    "grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 sm:grid-cols-[200px_minmax(0,1fr)_150px]";
  const track = "col-span-2 sm:col-span-1 sm:col-start-2";

  return (
    <div className="flex flex-col">
      {/* The scale: where the limit is, and where today's pace is. */}
      <div
        aria-hidden="true"
        className={cx(grid, "mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-muted")}
      >
        <div className={cx(track, "relative h-5")}>
          <span className="absolute -translate-x-1/2" style={{ left: at(1) }}>
            Limit
          </span>
          {pace != null && pace > 0 && pace < 1 && (
            <span className="absolute -translate-x-1/2 text-faint" style={{ left: at(pace) }}>
              Today
            </span>
          )}
        </div>
      </div>
      {rows.map((r) => {
        const p = budgetProgress(r.spent, r.limit);
        const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
        const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;
        const width = r.spent > 0 ? `max(6px, ${at(p.ratio)})` : "0%";
        return (
          <button
            key={r.key}
            type="button"
            onClick={() => onPick?.(r)}
            aria-label={`Edit ${r.name}: ${pct}% used, ${money(r.spent)} of ${money(r.limit)}, ${status}`}
            className={cx(
              grid,
              "group -mx-3 cursor-pointer items-center gap-y-2 rounded-xl px-3 py-3.5 text-left transition-colors hover:bg-surface",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{r.name}</span>
              <span className="truncate text-[13px] text-muted">
                {money(r.spent)} of {money(r.limit)}
              </span>
            </span>
            <span className={cx(track, "relative row-start-2 h-7 sm:row-start-1")}>
              {/* The limit's worth of track, and a fainter stretch past it. */}
              <span
                className="absolute inset-y-0 left-0 rounded-l-lg bg-surface-strong"
                style={{ width: at(1) }}
              />
              <span
                className="absolute inset-y-0 right-0 rounded-r-lg bg-surface"
                style={{ left: at(1) }}
              />
              <span
                className={cx(
                  "absolute inset-y-0 left-0 rounded-lg transition-[width] duration-700 ease-out",
                  FILL[p.state],
                )}
                style={{ width }}
              />
              {/* The limit line, cut through the bar in the page colour so it shows on red too. */}
              <span
                className="absolute -inset-y-1.5 w-[3px] -translate-x-1/2 rounded-full bg-bg"
                style={{ left: at(1) }}
              />
              <span
                className="absolute -inset-y-1.5 w-[1.5px] -translate-x-1/2 rounded-full bg-ink"
                style={{ left: at(1) }}
              />
              {pace != null && pace > 0 && pace < 1 && (
                <span
                  title={`Should be at ${Math.round(pace * 100)}% by today`}
                  className="absolute inset-y-1 w-[2.5px] -translate-x-1/2 rounded-full bg-bg/80"
                  style={{ left: at(pace) }}
                />
              )}
            </span>
            <span className="flex flex-col items-end text-right sm:col-start-3">
              <span className={cx("text-lg font-bold leading-tight", STATE_TEXT[p.state])}>
                {status}
              </span>
              <span className={cx("text-[13px] font-semibold tabular-nums", STATE_TEXT[p.state])}>
                {pct}%
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
