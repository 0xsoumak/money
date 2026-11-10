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
