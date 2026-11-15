import { dataviz } from "./tokens";

export type BudgetState = "ok" | "warning" | "over";

export interface BudgetProgress {
  /** spent / limit. Can exceed 1. */
  ratio: number;
  /** Blocks to fill on a `dataviz.meterBlocks` meter. */
  filled: number;
  state: BudgetState;
  /** Minor units left. 0 once the limit is reached. */
  remaining: number;
  /** Minor units spent beyond the limit. 0 while within it. */
  over: number;
}

/**
 * How full a budget is and what to call it. Shared by web and mobile so the
 * meter always means the same thing.
 *
 * - Under 80%: ok. 80% up to and including 100%: warning. Over 100%: over.
 * - A full meter means "at or past the limit", so it never looks full while there is room left.
 * - Any spending lights at least one block, so a started budget never looks untouched.
 */
export function budgetProgress(spent: number, limit: number): BudgetProgress {
  const blocks = dataviz.meterBlocks;
  const ratio = limit > 0 ? spent / limit : spent > 0 ? Number.POSITIVE_INFINITY : 0;
  const remaining = Math.max(0, limit - spent);
  const over = Math.max(0, spent - limit);

  let filled: number;
  if (spent <= 0) filled = 0;
  else if (ratio >= dataviz.overAt) filled = blocks;
  else filled = Math.min(blocks - 1, Math.max(1, Math.round(ratio * blocks)));

  const state: BudgetState =
    ratio > dataviz.overAt ? "over" : ratio >= dataviz.warnAt ? "warning" : "ok";

  return { ratio, filled, state, remaining, over };
}

export interface BudgetNudge {
  /** Which budget: one category's, or the overall monthly one. */
  scope: "category" | "overall";
  categoryId: string | null;
  state: Exclude<BudgetState, "ok">;
  progress: BudgetProgress;
}

const RANK: Record<BudgetState, number> = { ok: 0, warning: 1, over: 2 };

/**
 * The budgets that one save just pushed into a worse state (ok → warning, or into over).
 * Spending figures include the save. The deltas are how much it added to the category and to
 * the month's total (they differ when an edit moves an expense to another category).
 * Budgets that were already in that state stay quiet, so you are told once, not on every save.
 */
export function budgetNudges(input: {
  categoryId: string;
  categoryDelta: number;
  totalDelta: number;
  categorySpent: number;
  totalSpent: number;
  budget: { overall: number | null; categories: Record<string, number> };
}): BudgetNudge[] {
  const { categoryId, categoryDelta, totalDelta, categorySpent, totalSpent, budget } = input;
  const check = (
    scope: BudgetNudge["scope"],
    after: number,
    delta: number,
    limit: number | null | undefined,
  ): BudgetNudge | null => {
    if (!limit || limit <= 0 || delta <= 0) return null;
    const was = budgetProgress(after - delta, limit).state;
    const progress = budgetProgress(after, limit);
    if (progress.state === "ok" || RANK[progress.state] <= RANK[was]) return null;
    return {
      scope,
      categoryId: scope === "category" ? categoryId : null,
      state: progress.state,
      progress,
    };
  };
  return [
    check("category", categorySpent, categoryDelta, budget.categories[categoryId]),
    check("overall", totalSpent, totalDelta, budget.overall),
  ].filter((n): n is BudgetNudge => n !== null);
}

/** "Food: 85% of budget used · ₹600 left" or "Food: over budget by ₹250". */
export function budgetNudgeMessage(
  nudge: BudgetNudge,
  name: string,
  money: (minor: number) => string,
): string {
  const label = nudge.scope === "overall" ? "Monthly budget" : name;
  if (nudge.state === "over") return `${label}: over budget by ${money(nudge.progress.over)}`;
  const pct = Math.min(100, Math.floor(nudge.progress.ratio * 100));
  return `${label}: ${pct}% used · ${money(nudge.progress.remaining)} left`;
}
