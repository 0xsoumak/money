import { daysInMonth, heatLevel, heatLevels, shortDate, weekday } from "@money/shared";
import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import { cx } from "../ui";
import { ChartTip, compactMoney, TipRow, TipTitle, useWidth } from "./kit";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** One hue, light to dark: more spent, more lime. Level 0 is a day with nothing spent. */
// Day numbers keep contrast on every shade: muted on empty, light on faint lime, dark on bright.
const LEVEL = [
  "bg-surface text-muted",
  "bg-accent/20 text-ink",
  "bg-accent/40 text-ink",
  "bg-accent/70 text-on-accent",
  "bg-accent text-on-accent",
];

/**
 * The month as a calendar, each day shaded by what was spent. Spiky days and quiet
 * stretches show at a glance. Days still to come are outlined, today is ringed.
 */
export function CalendarHeat({
  month,
  daily,
  todayDate,
}: {
  month: string;
  daily: Map<string, number>;
  todayDate: string;
}) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);

  const days = daysInMonth(Number(month.slice(0, 4)), Number(month.slice(5, 7)));
  const dates = Array.from(
    { length: days },
    (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`,
  );
  const lead = weekday(dates[0] as string);
  const cuts = heatLevels(dates.map((d) => daily.get(d) ?? 0));
  const cell = (w - 6 * 6) / 7;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div ref={ref} className="relative">
        <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-semibold text-faint">
          {WEEKDAYS.map((d) => (
            <span key={d}>{d.slice(0, 1)}</span>
          ))}
        </div>
        <ol className="mt-1.5 grid grid-cols-7 gap-1.5">
          {Array.from({ length: lead }, (_, i) => (
            <li key={`pad${i}`} aria-hidden="true" />
          ))}
          {dates.map((date, i) => {
            const v = daily.get(date) ?? 0;
            const future = date > todayDate;
            const level = future ? 0 : heatLevel(v, cuts);
            return (
              <li
                key={date}
                tabIndex={future ? -1 : 0}
                aria-label={
                  future ? `${shortDate(date)}: still to come` : `${shortDate(date)}: ${money(v)}`
                }
                onPointerEnter={() => !future && setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className={cx(
                  "flex aspect-square items-center justify-center rounded-md text-[11px] font-semibold transition-transform duration-150",
                  future ? "border border-dashed border-line text-faint" : LEVEL[level],
                  date === todayDate && "ring-2 ring-ink ring-offset-2 ring-offset-bg",
                  hover === i && "scale-110",
                )}
              >
                {i + 1}
              </li>
            );
          })}
        </ol>
        {hover !== null && dates[hover] && (
          <ChartTip
            x={((lead + hover) % 7) * (cell + 6) + cell / 2}
            y={18 + Math.floor((lead + hover) / 7) * (cell + 6)}
            width={w}
          >
            <TipTitle>{shortDate(dates[hover])}</TipTitle>
            <TipRow swatch="bg-accent" value={money(daily.get(dates[hover]) ?? 0)} name="spent" />
          </ChartTip>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[13px] text-muted" aria-hidden="true">
        Less
        {LEVEL.map((c) => (
          <span key={c} className={cx("size-3 rounded-[3px]", c.split(" ")[0])} />
        ))}
        More
      </div>
    </figure>
  );
}

/** Average spend per weekday, Monday first, the highest in lime with its value at the tip. */
export function WeekdayBars({ averages }: { averages: number[] }) {
  const money = useMoney();
  const max = Math.max(1, ...averages);
  const top = averages.indexOf(Math.max(...averages));
  return (
    <ul className="flex flex-col gap-1.5">
      {averages.map((v, i) => (
        <li
          key={WEEKDAYS[i]}
          aria-label={`${WEEKDAYS[i]}: ${money(v)} on average`}
          className="grid grid-cols-[2.25rem_1fr] items-center gap-2"
        >
          <span className={cx("text-xs font-semibold", i === top ? "text-ink" : "text-muted")}>
            {WEEKDAYS[i]}
          </span>
          <span className="flex items-center gap-2">
            <span
              className={cx(
                "h-3.5 rounded-r-[4px] transition-[width] duration-500",
                i === top ? "bg-accent" : "bg-ink/30",
              )}
              style={{ width: `${Math.max(1, (v / max) * 78)}%` }}
            />
            <span
              className={cx(
                "text-xs tabular-nums",
                i === top ? "font-bold text-ink" : "text-muted",
              )}
            >
              {compactMoney(v)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
