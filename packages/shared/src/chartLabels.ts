// Short month and date labels, and the weekday sentence, worded once for every platform.
import { weekendRatio } from "./analytics";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11" → "Nov". */
export const shortMonth = (m: string) => MONTHS[Number(m.slice(5, 7)) - 1] ?? m;

/** "2026-11-07" → "Sat, 7 Nov". String based, so no timezone can shift it. */
export function shortDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number) as [number, number, number];
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, day)).getUTCDay()]}, ${day} ${MONTHS[m - 1]}`;
}

/** "Weekends cost 2× a weekday." and friends; shared with the Overview's insight card. */
export function weekdayHeadline(averages: number[]): string | null {
  const r = weekendRatio(averages);
  if (r === null) return null;
  if (r >= 1.15) return `Weekends cost ${r.toFixed(1).replace(/\.0$/, "")}× a weekday.`;
  if (r <= 0.87) return "Weekdays cost you more than weekends.";
  return "Spending is even across the week.";
}
