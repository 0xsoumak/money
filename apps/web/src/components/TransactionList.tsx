import { groupByDay } from "../lib/group";
import { useMoney } from "../lib/hooks";
import type { Category, Tx } from "../lib/queries";
import { TrashIcon } from "./icons";
import { useQuickAdd } from "./QuickAdd";
import { IconButton, SectionHeader } from "./ui";

interface Props {
  transactions: Tx[];
  categories: Category[];
  onDelete: (tx: Tx) => void;
}

/** Transactions grouped by day, newest first. Click a row to edit it. */
export function TransactionList({ transactions, categories, onDelete }: Props) {
  const money = useMoney();
  const { openEdit } = useQuickAdd();
  const byId = new Map(categories.map((c) => [c.id, c]));
  const groups = groupByDay(transactions);

  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <section key={g.date} aria-label={g.label}>
          <SectionHeader
            title={g.label}
            right={
              g.spent > 0 ? (
                <span className="text-sm font-semibold text-muted">{money(g.spent)}</span>
              ) : null
            }
          />
          <ul>
            {g.items.map((tx) => {
              const cat = byId.get(tx.categoryId);
              const title = tx.note || cat?.name || "Transaction";
              return (
                <li key={tx.id} className="group flex items-center border-b border-line">
                  <button
                    type="button"
                    onClick={() => openEdit(tx)}
                    className="flex min-h-[4.25rem] min-w-0 flex-1 cursor-pointer items-center gap-3.5 py-2 text-left"
                    aria-label={`Edit ${title}, ${money(tx.amount)}`}
                  >
                    <span
                      aria-hidden="true"
                      className="h-11 w-2.5 shrink-0 rounded-[3px]"
                      style={{ backgroundColor: `var(--cat-${cat?.color ?? "slate"})` }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-lg font-semibold">{title}</span>
                      <span className="block truncate text-[13px] text-muted">
                        {cat ? `${cat.emoji} ${cat.name}` : "Unknown category"}
                      </span>
                    </span>
                    <span className="shrink-0 text-xl font-bold">
                      {tx.type === "income" ? "+" : ""}
                      {money(tx.amount)}
                    </span>
                  </button>
                  <IconButton
                    label={`Delete ${title}`}
                    onClick={() => onDelete(tx)}
                    className="opacity-60 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <TrashIcon />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
