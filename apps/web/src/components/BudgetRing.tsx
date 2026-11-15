import { type BudgetState, budgetProgress } from "@money/shared";
import { useEffect, useState } from "react";
import { useMoney } from "../lib/hooks";
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
