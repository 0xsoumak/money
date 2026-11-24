import type { Tone } from "../charts/kit";
import { cx } from "../ui";

export interface HeroStat {
  label: string;
  value: string;
  /** One short line under the number, coloured by tone. */
  sub?: string;
  tone?: Tone;
  /** A small colour key before the label, tying the number to its chart. */
  dot?: string;
}

/**
 * The month in four big numbers, read before any chart: flat, divided by hairlines,
 * two across on a phone and four on a wide screen.
 */
export function HeroStats({ stats }: { stats: HeroStat[] }) {
  return (
    <dl className="grid grid-cols-2 gap-y-8 border-y-2 border-line-strong py-6 lg:grid-cols-4">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={cx(
            "flex min-w-0 flex-col gap-2 border-line",
            // Two across on a phone, four on a wide screen: hairlines only between columns.
            i % 2 === 0 ? "pr-4 sm:pr-6" : "border-l-2 pl-4 sm:pl-6",
            i === 1 && "lg:pr-6",
            i === 2 && "lg:border-l-2 lg:pl-6",
          )}
        >
          <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-muted">
            {s.dot && (
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: s.dot }}
              />
            )}
            {s.label}
          </dt>
          <dd className="m-0 truncate text-[32px] font-bold leading-none tracking-[-0.04em] tabular-nums sm:text-[44px]">
            {s.value}
          </dd>
          {s.sub && (
            <dd
              className={cx(
                "m-0 text-sm font-semibold",
                s.tone === "warn"
                  ? "text-danger"
                  : s.tone === "good"
                    ? "text-accent"
                    : "text-muted",
              )}
            >
              {s.sub}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}
