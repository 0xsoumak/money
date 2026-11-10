import { budgetInputSchema, budgetKeySchema } from "@money/shared";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { budgets, categories } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

const keyParam = z.object({ key: budgetKeySchema });

export const budgetsRoute = new Hono<AppEnv>()
  .get("/", async (c) => {
    const rows = await c.get("db").select().from(budgets).orderBy(asc(budgets.key));
    return c.json({ budgets: rows });
  })

  /** Set or change a budget. `key` is "overall" or an expense category id. */
  .put("/:key", validate("param", keyParam), validate("json", budgetInputSchema), async (c) => {
    const { key } = c.req.valid("param");
    const { amount } = c.req.valid("json");
    const db = c.get("db");

    let categoryId: string | null = null;
    if (key !== "overall") {
      const category = await db.query.categories.findFirst({ where: eq(categories.id, key) });
      if (!category) return c.json({ error: "Category not found" }, 404);
      if (category.kind !== "expense") {
        return c.json({ error: "Only expense categories can have a budget" }, 400);
      }
      categoryId = category.id;
    }

    const [row] = await db
      .insert(budgets)
      .values({ key, categoryId, amount })
      .onConflictDoUpdate({ target: budgets.key, set: { amount, updatedAt: new Date() } })
      .returning();
    return c.json({ budget: row });
  })

  /** Remove a budget. Removing one that doesn't exist is fine. */
  .delete("/:key", validate("param", keyParam), async (c) => {
    await c
      .get("db")
      .delete(budgets)
      .where(eq(budgets.key, c.req.valid("param").key));
    return c.body(null, 204);
  });
