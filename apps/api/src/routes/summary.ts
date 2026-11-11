import { addMonths, monthQuerySchema, monthRange } from "@money/shared";
import { and, count, gte, isNull, lt, sql, sum } from "drizzle-orm";
import { Hono } from "hono";
import { budgets, transactions } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

const TREND_MONTHS = 6;
const INVEST_MONTHS = 12;

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
    let invested = 0;
    for (const r of rows) {
      if (r.type === "expense") spent += r.total;
      else if (r.type === "income") income += r.total;
      else invested += r.total;
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

    // Net is what's left after spending and investing.
    const net = income - spent - invested;
    return c.json({ month, spent, income, invested, net, byCategory, budget });
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
      return {
        month: m,
        spent: of("expense"),
        income: of("income"),
        invested: of("investment"),
      };
    });
    return c.json({ months });
  })
  /**
   * Investments overview as of `month`: all-time total per bucket, this and
   * last calendar year, and the 12 months ending at `month` (oldest first).
   */
  .get("/investments", validate("query", monthQuerySchema), async (c) => {
    const { month } = c.req.valid("query");
    const db = c.get("db");
    const upTo = monthRange(month).end;
    const live = and(
      sql`${transactions.type} = 'investment'`,
      lt(transactions.date, upTo),
      isNull(transactions.deletedAt),
    );

    const byCategory = (
      await db
        .select({
          categoryId: transactions.categoryId,
          total: sql<number>`cast(${sum(transactions.amount)} as integer)`,
          count: count(),
        })
        .from(transactions)
        .where(live)
        .groupBy(transactions.categoryId)
    ).sort((a, b) => b.total - a.total);

    const monthly = await db
      .select({
        month: sql<string>`substr(${transactions.date}, 1, 7)`,
        total: sql<number>`cast(${sum(transactions.amount)} as integer)`,
      })
      .from(transactions)
      .where(live)
      .groupBy(sql`substr(${transactions.date}, 1, 7)`);

    const of = (m: string) => monthly.find((r) => r.month === m)?.total ?? 0;
    const year = Number(month.slice(0, 4));
    const inYear = (y: number) =>
      monthly.filter((r) => r.month.startsWith(`${y}-`)).reduce((t, r) => t + r.total, 0);
    const first = addMonths(month, -(INVEST_MONTHS - 1));

    return c.json({
      total: byCategory.reduce((t, r) => t + r.total, 0),
      thisYear: inYear(year),
      lastYear: inYear(year - 1),
      byCategory,
      months: Array.from({ length: INVEST_MONTHS }, (_, i) => {
        const m = addMonths(first, i);
        return { month: m, invested: of(m) };
      }),
    });
  });
