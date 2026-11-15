import { budgetNudgeMessage, budgetNudges, type TransactionType } from "@money/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useToast } from "../components/Toast";
import { warn } from "./haptics";
import { useMoney } from "./hooks";
import { type Category, type Summary, summaryQuery } from "./queries";

/** The parts of a transaction that decide which budgets it counts against. */
export interface Counted {
  type: TransactionType;
  amount: number;
  categoryId: string;
  date: string;
}

/**
 * After an expense is saved, warns if it pushed a budget past 80% or over its limit.
 * Reads the month's summary fresh from the server, so it is right even when that month
 * isn't on screen. Each budget speaks up once per crossing, not on every save.
 */
export function useBudgetNudge() {
  const qc = useQueryClient();
  const toast = useToast();
  const money = useMoney();

  return useCallback(
    async (saved: Counted, previous?: Counted | null) => {
      if (saved.type !== "expense") return;
      const month = saved.date.slice(0, 7);
      // For an edit, only the difference counts, and only where the old amount was counted.
      const prev =
        previous?.type === "expense" && previous.date.slice(0, 7) === month ? previous : null;
      const totalDelta = saved.amount - (prev?.amount ?? 0);
      const categoryDelta =
        saved.amount - (prev && prev.categoryId === saved.categoryId ? prev.amount : 0);
      if (totalDelta <= 0 && categoryDelta <= 0) return;

      let s: Summary;
      try {
        s = await qc.fetchQuery({ ...summaryQuery(month), staleTime: 0 });
      } catch {
        return; // a nudge is a nicety; never surface an error for it
      }
      const nudges = budgetNudges({
        categoryId: saved.categoryId,
        categoryDelta,
        totalDelta,
        categorySpent:
          s.byCategory.find((r) => r.type === "expense" && r.categoryId === saved.categoryId)
            ?.total ?? 0,
        totalSpent: s.spent,
        budget: s.budget,
      });
      if (nudges.length === 0) return;
      const name =
        qc.getQueryData<Category[]>(["categories"])?.find((x) => x.id === saved.categoryId)?.name ??
        "This category";
      warn();
      for (const n of nudges) {
        toast.show(budgetNudgeMessage(n, name, money), {
          tone: n.state === "over" ? "error" : "warning",
        });
      }
    },
    [qc, toast, money],
  );
}
