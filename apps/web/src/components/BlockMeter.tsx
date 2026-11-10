import { type BudgetState, budgetProgress, dataviz } from "@money/shared";
import { useEffect, useState } from "react";
import { useMoney } from "../lib/hooks";
import { cx } from "./ui";

const FILL: Record<BudgetState, string> = {
  ok: "bg-ink",
  warning: "bg-warning",
  over: "bg-danger",
};

const STATUS_TEXT: Record<BudgetState, string> = {
  ok: "text-muted",
  warning: "text-warning",
  over: "text-danger",
};

/** The 10-block meter. Blocks fill in one after another when the value first shows or changes. */
export function BlockMeter({
  spent,
  limit,
  label,
  className,
}: {
  spent: number;
  limit: number;
  label: string;
  className?: string;
}) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);

  // Start empty and fill on the next frame so the change is animated, not just painted.
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(p.filled));
    return () => cancelAnimationFrame(id);
  }, [p.filled]);

  const description =
    p.over > 0
      ? `${label}: ${money(spent)} of ${money(limit)}, ${money(p.over)} over`
      : `${label}: ${money(spent)} of ${money(limit)}, ${money(p.remaining)} left`;

  return (
    <div
      role="img"
      aria-label={description}
      className={cx("flex gap-[3px]", className)}
      style={{ height: dataviz.meterBlockHeight }}
    >
      {Array.from({ length: dataviz.meterBlocks }, (_, i) => (
        <div
          key={i}
          className={cx(
            "flex-1 rounded-[3px] transition-colors duration-300",
            i < shown ? FILL[p.state] : "bg-surface-strong",
          )}
          style={{ transitionDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

/** "₹1,680 left" or "₹60 over", colored by state. Words always accompany the color. */
export function BudgetStatus({ spent, limit }: { spent: number; limit: number }) {
  const money = useMoney();
  const p = budgetProgress(spent, limit);
  return (
    <span className={cx("font-bold", STATUS_TEXT[p.state])}>
      {p.over > 0 ? `${money(p.over)} over` : `${money(p.remaining)} left`}
    </span>
  );
}

/** One budget line: name and status, the meter, and the exact figures. */
export function BudgetRow({
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
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3 text-base font-semibold">
        <span className="min-w-0 truncate">{name}</span>
        <BudgetStatus spent={spent} limit={limit} />
      </span>
      <BlockMeter spent={spent} limit={limit} label={name} className="mt-2" />
      <span className="mt-1.5 block text-[13px] text-muted">
        {money(spent)} of {money(limit)}
      </span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className="block w-full cursor-pointer border-b border-line py-3.5 text-left"
    >
      {body}
    </button>
  ) : (
    <div className="border-b border-line py-3.5">{body}</div>
  );
}
