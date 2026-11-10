import { useMoney } from "../lib/hooks";
import type { Category } from "../lib/queries";

export interface ShareItem {
  categoryId: string;
  total: number;
}

/**
 * One bar, one segment per category, widths proportional to what was spent.
 * The legend repeats every amount in words so color is never the only signal.
 */
export function ShareBar({
  items,
  categories,
  left,
}: {
  items: ShareItem[];
  categories: Category[];
  /** Minor units still available in the overall budget; adds a dashed "left" segment. */
  left?: number;
}) {
  const money = useMoney();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const rows = items
    .filter((i) => i.total > 0)
    .sort((a, b) => b.total - a.total)
    .map((i) => {
      const cat = byId.get(i.categoryId);
      return { ...i, name: cat?.name ?? "Unknown", color: cat?.color ?? "slate" };
    });
  const total = rows.reduce((sum, r) => sum + r.total, 0);

  if (rows.length === 0) return null;

  const showLeft = left !== undefined && left > 0;
  const summary = [
    ...rows.map((r) => `${r.name} ${money(r.total)}`),
    ...(showLeft ? [`Left to spend ${money(left)}`] : []),
  ].join(", ");

  return (
    <section aria-label="Spending by category">
      <div role="img" aria-label={summary} className="flex h-10 gap-1">
        {rows.map((r) => (
          <div
            key={r.categoryId}
            className="min-w-1.5 rounded-[6px] transition-[flex-grow] duration-500"
            style={{ flexGrow: r.total, flexBasis: 0, backgroundColor: `var(--cat-${r.color})` }}
          />
        ))}
        {showLeft && (
          <div
            aria-hidden="true"
            className="rounded-[6px] border-2 border-dashed border-line-strong/30 transition-[flex-grow] duration-500"
            style={{ flexGrow: left, flexBasis: 0 }}
          />
        )}
      </div>
      <ul className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2.5 text-[15px]">
        {rows.map((r) => (
          <li key={r.categoryId} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-[3px]"
              style={{ backgroundColor: `var(--cat-${r.color})` }}
            />
            {r.name}
            <strong className="font-bold">{money(r.total)}</strong>
            <span className="text-muted">{Math.round((r.total / total) * 100)}%</span>
          </li>
        ))}
        {showLeft && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-3 rounded-[3px] border-2 border-dashed border-line-strong/40"
            />
            Left to spend
            <strong className="font-bold text-accent">{money(left)}</strong>
          </li>
        )}
      </ul>
    </section>
  );
}
