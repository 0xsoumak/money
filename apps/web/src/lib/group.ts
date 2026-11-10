import { today } from "@money/shared";

export interface DayTx {
  date: string;
  type: "expense" | "income";
  amount: number;
  createdAt: string;
}

export interface DayGroup<T extends DayTx> {
  date: string;
  label: string;
  /** Sum of expenses that day, in minor units. */
  spent: number;
  items: T[];
}

/** "Today", "Yesterday", else "Sun, Nov 8". Takes `now` so it is testable. */
export function dayLabel(date: string, now: string = today()): string {
  if (date === now) return "Today";
  const yesterday = new Date(`${now}T00:00:00Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) return "Yesterday";
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** Groups by date, newest day first, newest entry first within a day. */
export function groupByDay<T extends DayTx>(items: T[], now: string = today()): DayGroup<T>[] {
  const byDate = new Map<string, T[]>();
  for (const item of items) {
    const list = byDate.get(item.date);
    if (list) list.push(item);
    else byDate.set(item.date, [item]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, list]) => ({
      date,
      label: dayLabel(date, now),
      spent: list.reduce((sum, t) => sum + (t.type === "expense" ? t.amount : 0), 0),
      items: [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    }));
}

/** "November 2026" */
export function monthTitle(month: string): string {
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${month}-01T00:00:00Z`),
  );
}
