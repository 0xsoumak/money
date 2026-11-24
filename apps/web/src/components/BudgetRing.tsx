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
 * The progress ring itself, percentage in the middle. Same state colors as the
 * block meter. Over budget, the ring is a faded full lap and the solid arc is
 * the overspend (a second lap), so 108% and 227% look different.
 */
export function Ring({
  spent,
  limit,
  size,
  stroke,
  textClass,
}: {
  spent: number;
  limit: number;
  size: number;
  stroke: number;
  /** Size of the percentage, e.g. "text-[15px]". */
  textClass: string;
}) {
  const p = budgetProgress(spent, limit);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isOver = p.state === "over";
  const lap = isOver ? Math.min(p.ratio - 1, 1) : p.ratio;
  const target = spent > 0 ? Math.min(1, Math.max(lap, 0.02)) : 0;
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;

  // Start empty and sweep in on the next frame so the change is animated.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={isOver ? "stroke-danger/30" : "stroke-surface-strong"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown)}
          className={cx(STROKE[p.state], "transition-[stroke-dashoffset] duration-700 ease-out")}
        />
      </svg>
      <span
        aria-hidden="true"
        className={cx(
          "absolute inset-0 flex items-center justify-center font-bold tracking-[-0.03em]",
          textClass,
          STATE_TEXT[p.state],
        )}
      >
        {pct}%
      </span>
    </div>
  );
}

/**
 * A compact budget card: ring on the left; name, status in words and exact
 * figures beside it. The words carry the meaning, not the color.
 * With `onClick` the whole card is a button.
 */
export function BudgetRing({
  name,
  spent,
  limit,
  onClick,
}: {
  name: string;
  spent: number;
  limit: number;
  onClick?: () => void;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
  const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;
  const label = `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${status}`;

  const body = (
    <>
      <Ring spent={spent} limit={limit} size={64} stroke={7} textClass="text-[15px]" />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className={cx("text-lg font-bold leading-tight", STATE_TEXT[p.state])}>{status}</span>
        <span className="truncate text-[13px] text-muted">
          {money(spent)} of {money(limit)}
        </span>
      </span>
    </>
  );
  const box = "flex items-center gap-4 rounded-xl border-2 border-line px-4 py-3.5 text-left";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}`}
      className={cx(box, "w-full cursor-pointer transition-colors hover:border-line-strong/60")}
    >
      {body}
    </button>
  ) : (
    <div role="img" aria-label={label} className={box}>
      {body}
    </div>
  );
}

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

/**
 * A budget card for the Budgets page: a half donut on top, then the name, the status in
 * words and the exact figures, centred. With `onClick` the whole card is a button.
 */
export function BudgetGauge({
  name,
  spent,
  limit,
  pace,
  onClick,
}: {
  name: string;
  spent: number;
  limit: number;
  pace?: number | null;
  onClick?: () => void;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;
  const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;
  const label = `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${status}`;

  const body = (
    <>
      <HalfRing
        spent={spent}
        limit={limit}
        width={150}
        stroke={16}
        textClass="text-[26px]"
        pace={pace}
      />
      <span className="flex min-w-0 max-w-full flex-col items-center gap-0.5 text-center">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className={cx("text-xl font-bold leading-tight", STATE_TEXT[p.state])}>{status}</span>
        <span className="truncate text-[13px] text-muted">
          {money(spent)} of {money(limit)}
        </span>
      </span>
    </>
  );
  // Flat, like the rest of the page: no box, just a soft wash on hover.
  const box = "group relative flex flex-col items-center gap-3 rounded-2xl px-2 py-3 text-left";

  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Edit ${label}`}
      className={cx(box, "w-full cursor-pointer transition-colors hover:bg-surface")}
    >
      <span className="absolute top-3 right-3 text-muted opacity-0 transition-opacity group-hover:opacity-100">
        <PencilIcon size={14} />
      </span>
      {body}
    </button>
  ) : (
    <div role="img" aria-label={label} className={box}>
      {body}
    </div>
  );
}
