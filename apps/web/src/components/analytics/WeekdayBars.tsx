import { motion } from "motion/react";
import { useState } from "react";
import { useMoney } from "../../lib/hooks";
import { tween } from "../motion";
import { cx } from "../ui";
import { compactMoney, useWidth } from "./frame";

const H = 230;
const TOP = 26;
const BASE = 200;
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Bar with only its top corners rounded, standing on the baseline. */
function bar(x: number, y: number, w: number, r = 4) {
  const rr = Math.min(r, BASE - y);
  return `M${x},${BASE} L${x},${y + rr} Q${x},${y} ${x + rr},${y} L${x + w - rr},${y} Q${x + w},${y} ${x + w},${y + rr} L${x + w},${BASE} Z`;
}

/** Average spending for each day of the week. The busiest day is solid, labelled on every bar. */
export function WeekdayBars({ averages }: { averages: number[] }) {
  const money = useMoney();
  const [ref, w] = useWidth<HTMLDivElement>(560);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...averages, 1);
  const peak = averages.indexOf(Math.max(...averages));
  const step = w / 7;
  const bw = Math.min(56, step * 0.64);

  return (
    <div ref={ref} className="w-full">
      <svg
        width={w}
        height={H}
        role="img"
        aria-label={`Average spend by weekday: ${averages.map((v, i) => `${DAYS[i]} ${money(v)}`).join(", ")}.`}
        className="block"
        onPointerLeave={() => setHover(null)}
      >
        {averages.map((v, i) => {
          const x = i * step + (step - bw) / 2;
          const y = BASE - Math.max((v / max) * (BASE - TOP), v > 0 ? 3 : 1);
          const strong = i === peak || i === hover;
          return (
            <g key={DAYS[i]} onPointerEnter={() => setHover(i)}>
              <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
              <motion.path
                d={bar(x, y, bw)}
                className={cx("transition-colors", strong ? "fill-ink" : "fill-surface-strong")}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...tween.slow, delay: i * 0.04 }}
              />
              <text
                x={x + bw / 2}
                y={y - 8}
                textAnchor="middle"
                className={cx("text-[13px] font-bold", strong ? "fill-ink" : "fill-muted")}
              >
                {hover === i ? money(v) : compactMoney(v)}
              </text>
              <text
                x={x + bw / 2}
                y={H - 6}
                textAnchor="middle"
                className={cx(
                  "text-xs font-bold uppercase tracking-[0.06em]",
                  strong ? "fill-ink" : "fill-muted",
                )}
              >
                {DAYS[i]}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={w} y1={BASE} y2={BASE} className="stroke-line-strong" />
      </svg>
    </div>
  );
}
