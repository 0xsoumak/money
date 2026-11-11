import { addMonths, monthQuerySchema, monthRange } from "@money/shared";
import { and, count, gte, isNull, lt, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { budgets, transactions } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

const TREND_MONTHS = 6;

export const summaryRoute = new Hono<AppEnv>()
  .get("/", validate("query", monthQuerySchema), async (c) => {
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

    // Budgets apply to every month, so progress is just this month's spending against them.
    const budgetRows = await c.get("db").select().from(budgets);
    const budget = {
      overall: budgetRows.find((b) => b.key === "overall")?.amount ?? null,
      categories: Object.fromEntries(
        budgetRows.filter((b) => b.categoryId).map((b) => [b.categoryId as string, b.amount]),
      ),
    };

    return c.json({ month, spent, income, net: income - spent, byCategory, budget });
  })
  /** Spent and income for the six months ending at `month`, oldest first. Empty months are zeros. */
  .get("/trend", validate("query", monthQuerySchema), async (c) => {
    const { month } = c.req.valid("query");
    const first = addMonths(month, -(TREND_MONTHS - 1));
    const rows = await c
      .get("db")
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        type: transactions.type,
        total: sql<number>`cast(${sum(transactions.amount)} as integer)`,
      })
      .from(transactions)
      .where(
        and(
          gte(transactions.date, monthRange(first).start),
          lt(transactions.date, monthRange(month).end),
          isNull(transactions.deletedAt),
        ),
      )
      .groupBy(sql`substr(${transactions.date}, 1, 7)`, transactions.type);

    const months = Array.from({ length: TREND_MONTHS }, (_, i) => {
      const m = addMonths(first, i);
      const of = (type: string) => rows.find((r) => r.month === m && r.type === type)?.total ?? 0;
      return { month: m, spent: of("expense"), income: of("income") };
    });
    return c.json({ months });
  });
