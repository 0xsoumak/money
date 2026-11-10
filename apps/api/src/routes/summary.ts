import { monthQuerySchema, monthRange } from "@money/shared";
import { and, count, gte, isNull, lt, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { transactions } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

export const summaryRoute = new Hono<AppEnv>().get(
  "/",
  validate("query", monthQuerySchema),
  async (c) => {
    const { month } = c.req.valid("query");
    const { start, end } = monthRange(month);

    const rows = await c
      .get("db")
      .select({
        type: transactions.type,
        categoryId: transactions.categoryId,
        total: sql<number>`cast(${sum(transactions.amount)} as integer)`,
        count: count(),
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, start),
          lt(transactions.date, end),
          isNull(transactions.deletedAt),
        ),
      )
      .groupBy(transactions.type, transactions.categoryId);

    let spent = 0;
    let income = 0;
    for (const r of rows) {
      if (r.type === "expense") spent += r.total;
      else income += r.total;
    }
    const byCategory = rows.sort((a, b) => b.total - a.total);

    return c.json({ month, spent, income, net: income - spent, byCategory });
  },
);
