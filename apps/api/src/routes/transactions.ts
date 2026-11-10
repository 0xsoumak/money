import { idSchema, monthQuerySchema, monthRange, transactionInputSchema } from "@money/shared";
import { and, desc, eq, gte, isNotNull, isNull, lt } from "drizzle-orm";
import { Hono } from "hono";
import { categories, transactions } from "../db/schema";
import { idParam, validate } from "../lib/validate";
import type { AppEnv } from "../types";

const byId = validate("param", idParam(idSchema));

export const transactionsRoute = new Hono<AppEnv>()
  .get("/", validate("query", monthQuerySchema), async (c) => {
    const { start, end } = monthRange(c.req.valid("query").month);
    const rows = await c
      .get("db")
      .select()
      .from(transactions)
      .where(
        and(
          gte(transactions.date, start),
          lt(transactions.date, end),
          isNull(transactions.deletedAt),
        ),
      )
      .orderBy(desc(transactions.date), desc(transactions.createdAt));
    return c.json({ transactions: rows });
  })

  /**
   * Create or update by client-generated id. Sending the same request twice is
   * safe, which is what lets the mobile app retry failed saves blindly.
   * Updating a soft-deleted transaction does not restore it.
   */
  .put("/:id", byId, validate("json", transactionInputSchema), async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = c.get("db");

    const category = await db.query.categories.findFirst({
      where: eq(categories.id, input.categoryId),
    });
    if (!category) return c.json({ error: "Category not found" }, 400);
    if (category.kind !== input.type) {
      return c.json({ error: `Category is for ${category.kind}, not ${input.type}` }, 400);
    }

    const values = {
      type: input.type,
      amount: input.amount,
      categoryId: input.categoryId,
      date: input.date,
      note: input.note || null,
    };
    const [row] = await db
      .insert(transactions)
      .values({ id, ...values })
      .onConflictDoUpdate({ target: transactions.id, set: { ...values, updatedAt: new Date() } })
      .returning();
    return c.json({ transaction: row });
  })

  /** Soft delete; the client shows an Undo toast that calls /restore. */
  .delete("/:id", byId, async (c) => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [row] = await db
      .update(transactions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(transactions.id, id), isNull(transactions.deletedAt)))
      .returning({ id: transactions.id });
    if (!row) {
      // Already deleted is fine (idempotent); unknown id is a 404.
      const exists = await db.query.transactions.findFirst({ where: eq(transactions.id, id) });
      if (!exists) return c.json({ error: "Transaction not found" }, 404);
    }
    return c.body(null, 204);
  })

  .post("/:id/restore", byId, async (c) => {
    const { id } = c.req.valid("param");
    const db = c.get("db");
    const [row] = await db
      .update(transactions)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), isNotNull(transactions.deletedAt)))
      .returning();
    if (row) return c.json({ transaction: row });
    const existing = await db.query.transactions.findFirst({ where: eq(transactions.id, id) });
    if (!existing) return c.json({ error: "Transaction not found" }, 404);
    return c.json({ transaction: existing });
  });
