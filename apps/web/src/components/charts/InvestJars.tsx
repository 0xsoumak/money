import { monthTitle } from "@money/shared";
import { useMoney } from "../../lib/hooks";
import { cx } from "../ui";
import { compactMoney, shortMonth } from "./kit";

export interface Jar {
  month: string;
  invested: number;
  /** Share of income invested; null without income. */
  rate: number | null;
  current: boolean;
}

/**
 * One jar per month, filled with lime up to what went in that month (the fullest month
 * fills its jar). A month with nothing invested is an empty dashed jar. Clicking opens it.
 */
export function InvestJars({ jars, onPick }: { jars: Jar[]; onPick?: (month: string) => void }) {
  const money = useMoney();
  const max = Math.max(1, ...jars.map((j) => j.invested));
  const pct = (r: number) => `${Math.round(r * 100)}%`;

  return (
    <ul
      className="grid gap-2 sm:gap-3"
      style={{ gridTemplateColumns: `repeat(${jars.length}, minmax(0, 1fr))` }}
    >
      {jars.map((j) => {
        const empty = j.invested <= 0;
        const fill = empty ? 0 : Math.max(6, (j.invested / max) * 100);
        const tip = `${monthTitle(j.month)}: ${empty ? "nothing invested" : `${money(j.invested)} invested`}${j.rate !== null ? `, ${pct(j.rate)} of income` : ""}`;
        return (
          <li key={j.month} className="min-w-0">
            <button
              type="button"
              title={tip}
              aria-label={tip}
              onClick={() => onPick?.(j.month)}
              className="group flex w-full cursor-pointer flex-col items-center gap-2"
            >
              <span
                className={cx(
                  "text-[13px] font-bold tabular-nums",
                  empty ? "text-faint" : "text-ink",
                )}
              >
                {empty ? "–" : compactMoney(j.invested)}
              </span>
              <span
                className={cx(
                  "relative block h-32 w-full max-w-14 overflow-hidden rounded-xl border-2 transition-colors",
                  empty
                    ? "border-dashed border-line-strong/35"
                    : j.current
                      ? "border-ink"
                      : "border-line-strong/50 group-hover:border-line-strong",
                )}
              >
                <span
                  className={cx(
                    "absolute inset-x-0 bottom-0 rounded-t-[4px] transition-[height] duration-700",
                    j.current ? "bg-accent" : "bg-accent/70",
                  )}
                  style={{ height: `${fill}%` }}
                />
              </span>
              <span className="flex flex-col items-center leading-tight">
                <span
                  className={cx("text-[13px] font-semibold", j.current ? "text-ink" : "text-muted")}
                >
                  {shortMonth(j.month)}
                </span>
                <span className="text-[12px] text-faint tabular-nums">
                  {j.rate !== null ? pct(j.rate) : "–"}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
