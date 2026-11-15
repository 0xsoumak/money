import type { RepeatSpend } from "@money/shared";
import { motion } from "motion/react";
import { useMoney } from "../../lib/hooks";
import type { Category } from "../../lib/queries";
import { tween } from "../motion";
import { cx } from "../ui";
import { seriesOf } from "./frame";

/** Notes that keep coming back: how often and how much. Monthly ones are tagged. */
export function RepeatSpends({
  items,
  byId,
}: {
  items: RepeatSpend[];
  byId: Map<string, Category>;
}) {
  const money = useMoney();
  if (items.length === 0) {
    return (
      <p className="border-b border-line py-8 text-muted">
        Nothing repeats yet. Add a note to expenses (like “Swiggy”) to see them here.
      </p>
    );
  }
  const max = Math.max(...items.map((r) => r.total));
  return (
    <ul>
      {items.map((r, i) => (
        <li
          key={r.note}
          className="grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1.5 border-b border-line py-3"
        >
          <span
            aria-hidden="true"
            className="row-span-2 h-[38px] w-2.5 rounded-[3px]"
            style={{ background: seriesOf(r.categoryId, byId).color }}
          />
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="truncate text-[17px] font-semibold">{r.note}</span>
            <span
              className={cx(
                "shrink-0 rounded-md border px-1.5 py-0.5 text-xs font-bold uppercase tracking-[0.06em]",
                r.monthly ? "border-accent text-accent" : "border-line text-muted",
              )}
            >
              {r.monthly ? "Monthly" : `×${r.count}`}
            </span>
          </span>
          <span className="text-right text-[17px] font-bold">
            {r.monthly ? `${money(r.latest)}/mo` : money(r.total)}
          </span>
          <span
            aria-hidden="true"
            className="col-span-2 h-1.5 overflow-hidden rounded-[3px] bg-surface"
          >
            <motion.span
              className="block h-full rounded-[3px] bg-muted"
              initial={{ width: 0 }}
              animate={{ width: `${(r.total / max) * 100}%` }}
              transition={{ ...tween.slow, delay: i * 0.05 }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}
