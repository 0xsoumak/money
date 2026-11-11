import { type BudgetState, budgetProgress } from "@money/shared";
import { useEffect, useState } from "react";
import { useMoney } from "../lib/hooks";
import { BudgetStatus } from "./BlockMeter";
import { cx } from "./ui";

const STROKE: Record<BudgetState, string> = {
  ok: "stroke-ink",
  warning: "stroke-warning",
  over: "stroke-danger",
};

const PCT_TEXT: Record<BudgetState, string> = {
  ok: "text-ink",
  warning: "text-warning",
  over: "text-danger",
};

/**
 * A progress ring for one budget: how much of the limit is used, with the
 * percentage in the middle and the exact figures underneath. Same state
 * colors as the block meter; the words carry the meaning, not the color.
 */
export function BudgetRing({
  name,
  spent,
  limit,
  size = 104,
}: {
  name: string;
  spent: number;
  limit: number;
  size?: number;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  const stroke = Math.round(size / 9);
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const isOver = p.state === "over";
  // Over budget, the ring is a faded full lap and the solid arc is the overspend
  // (a second lap), so 108% and 227% look different.
  const lap = isOver ? Math.min(p.ratio - 1, 1) : p.ratio;
  const target = spent > 0 ? Math.min(1, Math.max(lap, 0.02)) : 0;
  const pct = Number.isFinite(p.ratio) ? Math.round(p.ratio * 100) : 100;

  // Start empty and sweep in on the next frame so the change is animated.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(target));
    return () => cancelAnimationFrame(id);
  }, [target]);

  const description =
    p.over > 0
      ? `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${money(p.over)} over`
      : `${name}: ${pct}% used, ${money(spent)} of ${money(limit)}, ${money(p.remaining)} left`;

  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-line p-4 text-center">
      <div
        role="img"
        aria-label={description}
        className="relative"
        style={{ width: size, height: size }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          aria-hidden="true"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className={isOver ? "stroke-danger/35" : "stroke-surface-strong"}
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
            "absolute inset-0 flex items-center justify-center text-xl font-bold tracking-[-0.03em]",
            PCT_TEXT[p.state],
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="flex w-full min-w-0 flex-col gap-0.5">
        <span className="truncate text-base font-semibold">{name}</span>
        <span className="text-sm">
          <BudgetStatus spent={spent} limit={limit} />
        </span>
        <span className="text-[13px] text-muted">
          {money(spent)} of {money(limit)}
        </span>
      </div>
    </div>
  );
}
