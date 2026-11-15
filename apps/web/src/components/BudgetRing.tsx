import { type BudgetState, budgetProgress } from "@money/shared";
import { useEffect, useState } from "react";
import { useMoney } from "../lib/hooks";
import { cx } from "./ui";

const STROKE: Record<BudgetState, string> = {
  ok: "stroke-ink",
  warning: "stroke-warning",
  over: "stroke-danger",
};

const TEXT: Record<BudgetState, string> = {
  ok: "text-ink",
  warning: "text-warning",
  over: "text-danger",
};

/**
 * A compact budget card: a progress ring with the percentage inside, and the
 * name, status in words and exact figures beside it. Same state colors as the
 * block meter; the words carry the meaning, not the color.
 *
 * Over budget, the ring is a faded full lap and the solid arc is the overspend
 * (a second lap), so 108% and 227% look different.
 */
export function BudgetRing({
  name,
  spent,
  limit,
  size = 64,
}: {
  name: string;
  spent: number;
  limit: number;
  size?: number;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const stroke = 7;
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

  const status = p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`;

  return (
    <div
      role="img"
      aria-label={`${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${status}`}
      className="flex items-center gap-4 rounded-xl border-2 border-line px-4 py-3.5"
    >
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
          className={cx(
            "absolute inset-0 flex items-center justify-center text-[15px] font-bold tracking-[-0.03em]",
            TEXT[p.state],
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className={cx("text-lg font-bold leading-tight", TEXT[p.state])}>{status}</span>
        <span className="truncate text-[13px] text-muted">
          {money(spent)} of {money(limit)}
        </span>
      </div>
    </div>
  );
}
