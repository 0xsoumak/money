import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SearchIcon } from "../../components/icons";
import { MonthSwitcher } from "../../components/MonthSwitcher";
import { TransactionList } from "../../components/TransactionList";
import { cx, EmptyState, fieldClass, Skeleton } from "../../components/ui";
import { useMoney, useMonth } from "../../lib/hooks";
import { categoriesQuery, transactionsQuery } from "../../lib/queries";
import { useDeleteWithUndo } from "../../lib/useDeleteWithUndo";

export const Route = createFileRoute("/_app/transactions")({
  component: Transactions,
});

type TypeFilter = "all" | "expense" | "income";
const TYPES: { value: TypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "expense", label: "Expenses" },
  { value: "income", label: "Income" },
];

function Transactions() {
  const { month } = useMonth();
  const money = useMoney();
  const deleteWithUndo = useDeleteWithUndo();
  const { data: categories = [] } = useQuery(categoriesQuery);
  const txs = useQuery({ ...transactionsQuery(month), placeholderData: keepPreviousData });

  const [type, setType] = useState<TypeFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [text, setText] = useState("");

  const filtered = useMemo(() => {
    const needle = text.trim().toLowerCase();
    const names = new Map(categories.map((c) => [c.id, c.name.toLowerCase()]));
    return (txs.data ?? []).filter(
      (t) =>
        (type === "all" || t.type === type) &&
        (!categoryId || t.categoryId === categoryId) &&
        (!needle ||
          (t.note ?? "").toLowerCase().includes(needle) ||
          (names.get(t.categoryId) ?? "").includes(needle)),
    );
  }, [txs.data, categories, type, categoryId, text]);

  const total = filtered.reduce((sum, t) => sum + (t.type === "expense" ? t.amount : 0), 0);
  const filtering = type !== "all" || categoryId !== "" || text !== "";

  return (
    <div className="flex flex-col gap-6">
      <MonthSwitcher />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1.5" role="group" aria-label="Type">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
              className={cx(
                "min-h-11 cursor-pointer rounded-lg px-4 text-sm font-bold uppercase tracking-wider",
                type === t.value ? "bg-ink text-bg" : "border-2 border-line-strong/25 text-muted",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <select
          aria-label="Category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className={cx(fieldClass, "w-auto min-w-44")}
        >
          <option value="">All categories</option>
          {categories
            .filter((c) => !c.archivedAt)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
        </select>
        <label className="relative min-w-52 flex-1">
          <span className="sr-only">Search notes and categories</span>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">
            <SearchIcon />
          </span>
          <input
            type="search"
            placeholder="Search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={cx(fieldClass, "pl-10")}
          />
        </label>
      </div>

      {filtering && (
        <p className="text-sm font-semibold text-muted">
          {filtered.length} {filtered.length === 1 ? "result" : "results"}
          {total > 0 && ` · ${money(total)} spent`}
        </p>
      )}

      {txs.isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={filtering ? "No matches" : "No transactions this month"}
          hint={filtering ? "Try clearing a filter." : "Press N to add one."}
        />
      ) : (
        <TransactionList
          transactions={filtered}
          categories={categories}
          onDelete={deleteWithUndo}
        />
      )}
    </div>
  );
}
