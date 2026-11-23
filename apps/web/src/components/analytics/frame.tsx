import { MASKED_MONEY } from "@money/shared";
import { isHidden } from "../../lib/privacy";

/** Short month and date labels live in shared so every platform words them alike. */
export { shortDate, shortMonth } from "@money/shared";

/** Compact money for tight labels: ₹950, ₹1.2k, ₹45k, ₹1.2L. */
// Callers also use useMoney, so they re-render when balances are hidden or shown.
export function compactMoney(minor: number): string {
  if (isHidden()) return MASKED_MONEY;
  const r = Math.round(minor / 100);
  if (r >= 100_000) return `₹${trim(r / 100_000)}L`;
  if (r >= 1000) return `₹${trim(r / 1000)}k`;
  return `₹${r}`;
}
const trim = (n: number) =>
  n >= 10 ? Math.round(n).toString() : (Math.round(n * 10) / 10).toString();
