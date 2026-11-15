import { ANALYTICS_MONTHS, addMonths, monthQuerySchema, monthRange } from "@money/shared";
import { and, asc, gte, isNull, lt } from "drizzle-orm";
import { Hono } from "hono";
import { transactions } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

/**
 * Raw rows for the Analytics page: every live transaction in the 13 months
 * ending at `month`, oldest first. The page computes its charts from these
 * with the shared analytics functions, so ranges switch without a refetch.
 */
export const analyticsRoute = new Hono<AppEnv>().get(
  "/",
  validate("query", monthQuerySchema),
  async (c) => {
    const { month } = c.req.valid("query");
    const first = addMonths(month, -(ANALYTICS_MONTHS - 1));
    const rows = await c
      .get("db")
      .select({
        date: transactions.date,
        type: transactions.type,
        categoryId: transactions.categoryId,
        amount: transactions.amount,
        note: transactions.note,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, monthRange(first).start),
          lt(transactions.date, monthRange(month).end),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(asc(transactions.date));
    return c.json({ from: first, to: month, rows });
  },
);
