import { heatLevel, heatLevels, weekday } from "@money/shared";
import { useRef, useState } from "react";
import { useMoney } from "../../lib/hooks";
import { ChartTip, shortDate, shortMonth, useWidth } from "./frame";

/** One hue, dim to bright: level 0 is "nothing spent", 4 the busiest days. */
const LEVELS = [
  "var(--surface)",
  "color-mix(in oklab, var(--accent) 25%, var(--bg))",
  "color-mix(in oklab, var(--accent) 45%, var(--bg))",
  "color-mix(in oklab, var(--accent) 70%, var(--bg))",
  "var(--accent)",
];

const LEFT = 34;
const TOP = 22;

/** Every day in the range as a tile, one column per week (Monday on top). */
export function YearHeatmap({
  dates,
  daily,
  todayDate,
}: {
  dates: string[];
  daily: Map<string, number>;
  todayDate: string;
}) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(1100);
  const [hover, setHover] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const offset = dates.length ? weekday(dates[0] as string) : 0;
  const cols = Math.ceil((dates.length + offset) / 7);
  // Fill the width, but keep each step between 12 and 25 px.
  const step = Math.max(12, Math.min(25, Math.floor((w - LEFT) / Math.max(cols, 1))));
  const size = step - 3;
  const cuts = heatLevels(dates.map((d) => daily.get(d) ?? 0));

  const cells = dates.map((date, i) => {
    const total = daily.get(date) ?? 0;
    return {
      date,
      total,
      x: LEFT + Math.floor((i + offset) / 7) * step,
      y: TOP + weekday(date) * step,
      fill: LEVELS[heatLevel(total, cuts)],
    };
  });
  const months = cells.filter((c, i) => i === 0 || c.date.endsWith("-01"));
  const width = LEFT + cols * step;
  const hovered = hover === null ? null : cells[hover];

  return (
    <div ref={ref} className="relative w-full">
      {/* Scrolls sideways on narrow screens; the tooltip sits outside so it isn't clipped. */}
      <div ref={scroller} className="overflow-x-auto">
        <svg
          width={width}
          height={TOP + 7 * step}
          role="img"
          aria-label={`Daily spending for ${dates.length} days, brighter tiles mean more spent.`}
          className="block"
          onPointerLeave={() => setHover(null)}
        >
          {months.map((m) => (
            <text key={m.date} x={m.x} y={12} className="fill-muted text-[11px]">
              {shortMonth(m.date)}
            </text>
          ))}
          {[
            [0, "Mon"],
            [2, "Wed"],
            [4, "Fri"],
          ].map(([row, label]) => (
            <text
              key={label}
              x={0}
              y={TOP + (row as number) * step + size - 3}
              className="fill-faint text-[11px]"
            >
              {label}
            </text>
          ))}
          {cells.map((c, i) => (
            <rect
              key={c.date}
              x={c.x}
              y={c.y}
              width={size}
              height={size}
              rx={3}
              style={{ fill: c.fill }}
              className={
                c.date === todayDate ? "stroke-ink" : hover === i ? "stroke-ink/60" : undefined
              }
              strokeWidth={2}
              onPointerEnter={() => setHover(i)}
            />
          ))}
        </svg>
      </div>
      {hovered && (
        <ChartTip x={hovered.x + size / 2 - (scroller.current?.scrollLeft ?? 0)} y={hovered.y}>
          <span className="text-muted">{shortDate(hovered.date)}</span>{" "}
          <strong>{hovered.total > 0 ? money(hovered.total) : "No spend"}</strong>
        </ChartTip>
      )}
      <div className="mt-3 flex items-center justify-end gap-1 text-[13px] text-muted">
        Less
        {LEVELS.map((fill) => (
          <span
            key={fill}
            aria-hidden="true"
            className="size-3.5 rounded-[3px]"
            style={{ background: fill }}
          />
        ))}
        More
      </div>
    </div>
  );
}
