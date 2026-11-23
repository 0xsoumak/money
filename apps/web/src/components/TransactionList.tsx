import { groupByDay, signedAmount, type TransactionType } from "@money/shared";
import { AnimatePresence, motion } from "motion/react";
import { useMoney } from "../lib/hooks";
import type { Category, Tx } from "../lib/queries";
import { TrashIcon } from "./icons";
import { tween } from "./motion";
import { useQuickAdd } from "./QuickAdd";
import { cx, IconButton, SectionHeader } from "./ui";

/**
 * How each amount reads in a list. Spending is the common case, so it stays plain ink
 * (a column of red reads as alarm); income is green with a plus; investing uses the accent
 * with no minus, since the money is moved, not lost.
 */
const AMOUNT: Record<TransactionType, { sign: string; className: string }> = {
  expense: { sign: "−", className: "" },
  income: { sign: "+", className: "text-success" },
  investment: { sign: "", className: "text-accent" },
};

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
    <div className="flex flex-col gap-8">
      {groups.map((g) => {
        const invested = g.items.reduce(
          (sum, t) => sum + (t.type === "investment" ? t.amount : 0),
          0,
        );
        return (
          <section key={g.date} aria-label={g.label}>
            <SectionHeader
              title={g.label}
              right={
                g.spent > 0 || invested > 0 ? (
                  <span className="flex gap-3 text-sm font-semibold text-muted">
                    {g.spent > 0 && <span>{money(g.spent)} spent</span>}
                    {invested > 0 && <span>{money(invested)} invested</span>}
                  </span>
                ) : null
              }
            />
            <ul className="mt-1.5 flex flex-col">
              <AnimatePresence initial={false}>
                {g.items.map((tx) => {
                  const cat = byId.get(tx.categoryId);
                  const catName = cat?.name ?? "Unknown category";
                  // A note that just repeats the category adds nothing; show one line instead.
                  const note = tx.note?.trim();
                  const hasNote = !!note && note.toLowerCase() !== catName.toLowerCase();
                  const title = hasNote ? note : catName;
                  const color = `var(--cat-${cat?.color ?? "slate"})`;
                  const amount = AMOUNT[tx.type];
                  const verb = signedAmount(tx.type).verb;
                  return (
                    <motion.li
                      key={tx.id}
                      layout="position"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={tween.base}
                      className="group -mx-2 flex items-center overflow-hidden rounded-xl transition-colors duration-150 hover:bg-surface/60 focus-within:bg-surface/60"
                    >
                      <button
                        type="button"
                        onClick={() => openEdit(tx)}
                        className="flex min-h-16 min-w-0 flex-1 cursor-pointer items-center gap-3.5 px-2 py-2 text-left"
                        aria-label={`Edit ${title}, ${verb} ${money(tx.amount)}`}
                      >
                        <span
                          aria-hidden="true"
                          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-xl"
                          style={{
                            backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                            boxShadow: `inset 0 0 0 1.5px color-mix(in srgb, ${color} 35%, transparent)`,
                          }}
                        >
                          {cat?.emoji ?? "?"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-base font-semibold sm:text-[17px]">
                            {title}
                          </span>
                          {hasNote && (
                            <span className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-muted">
                              <span
                                aria-hidden="true"
                                className="size-2 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              {catName}
                            </span>
                          )}
                        </span>
                        <span
                          className={cx(
                            "shrink-0 text-lg font-bold tabular-nums tracking-tight",
                            amount.className,
                          )}
                        >
                          {amount.sign}
                          {money(tx.amount)}
                        </span>
                      </button>
                      {/* Takes no room until hovered, so amounts line up with the day totals. */}
                      <div className="w-0 shrink-0 overflow-hidden transition-[width] duration-150 group-hover:w-12 group-focus-within:w-12 [@media(hover:none)]:w-12">
                        <IconButton
                          label={`Delete ${title}`}
                          onClick={() => onDelete(tx)}
                          className="text-muted hover:text-danger"
                        >
                          <TrashIcon />
                        </IconButton>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          </section>
        );
      })}
    </div>
  );
}
