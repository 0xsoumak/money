import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import { catTint, cx } from "../ui";
import { ChartTip, compactMoney, Key, Legend, TipRow, TipTitle, useWidth } from "./kit";

export interface DumbbellRow {
  key: string;
  name: string;
  emoji: string;
  /** Category colour name, for the tile behind the emoji. */
  color: string;
  now: number;
  usual: number;
  /** Big enough to call out: coloured by direction. Others stay neutral. */
  notable: boolean;
}

const tone = (r: DumbbellRow) =>
  !r.notable ? "neutral" : r.now > r.usual ? "up" : ("down" as const);

const dot = { neutral: "bg-ink", up: "bg-danger", down: "bg-success" };
const bar = { neutral: "bg-ink/25", up: "bg-danger/45", down: "bg-success/45" };
const text = { neutral: "text-muted", up: "text-danger", down: "text-success" };

/**
 * Each category as a line from its usual amount (ring) to this month's (dot), on one
 * shared scale. Only notable changes get colour, so the eye goes straight to them.
 */
export function Dumbbell({ rows, running }: { rows: DumbbellRow[]; running: boolean }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLUListElement>(400);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...rows.map((r) => Math.max(r.now, r.usual)));
  const pct = (v: number) => (v / max) * 100;
  const ROW = 52;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <div className="relative">
        <ul ref={ref} className="flex flex-col">
          {rows.map((r, i) => {
            const t = tone(r);
            const lo = Math.min(r.now, r.usual);
            const hi = Math.max(r.now, r.usual);
            const diff = r.now - r.usual;
            return (
              <li
                key={r.key}
                tabIndex={0}
                aria-label={`${r.name}: ${money(r.now)}${running ? " so far" : ""}, usually ${money(r.usual)}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className={cx(
                  "grid grid-cols-[minmax(0,9rem)_1fr_4.5rem] items-center gap-3 rounded-lg px-1 transition-opacity duration-200",
                  hover !== null && hover !== i && "opacity-45",
                )}
                style={{ height: ROW }}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg border-[1.5px] text-base"
                    style={catTint(r.color)}
                  >
                    {r.emoji}
                  </span>
                  <span className="truncate text-sm font-semibold">{r.name}</span>
                </span>
                <span className="relative h-4" aria-hidden="true">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                  <span
                    className={cx("absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full", bar[t])}
                    style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
                  />
                  <span
                    className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-muted bg-bg"
                    style={{ left: `${pct(r.usual)}%` }}
                  />
                  <span
                    className={cx(
                      "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-bg",
                      dot[t],
                    )}
                    style={{ left: `${pct(r.now)}%` }}
                  />
                </span>
                <span className={cx("text-right text-sm font-bold tabular-nums", text[t])}>
                  {Math.abs(diff) < 100 ? "–" : `${diff > 0 ? "+" : ""}${compactMoney(diff)}`}
                </span>
              </li>
            );
          })}
        </ul>
        {hover !== null && rows[hover] && (
          <ChartTip x={w / 2} y={hover * ROW + 8} width={w}>
            <TipTitle>{rows[hover].name}</TipTitle>
            <TipRow
              swatch={dot[tone(rows[hover])]}
              value={money(rows[hover].now)}
              name={running ? "so far" : "this month"}
            />
            <TipRow
              swatch="bg-muted"
              value={money(rows[hover].usual)}
              name={running ? "usual by now" : "usual"}
            />
          </ChartTip>
        )}
      </div>
      <Legend>
        <Key shape="ring" className="border-muted">
          {running ? "Usual by now" : "Usual"}
        </Key>
        <Key shape="dot" className="bg-ink">
          This month
        </Key>
        <Key shape="dot" className="bg-danger">
          Notably up
        </Key>
        <Key shape="dot" className="bg-success">
          Notably down
        </Key>
      </Legend>
    </figure>
  );
}
