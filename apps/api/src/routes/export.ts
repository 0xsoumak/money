import { asc } from "drizzle-orm";
import { Hono } from "hono";
import { budgets, categories, settings, transactions } from "../db/schema";
import type { AppEnv } from "../types";

/**
 * Everything the app stores, as one JSON file, for keeping a copy outside
 * Cloudflare. Includes soft-deleted transactions (they carry `deletedAt`).
 * Auth tables are left out on purpose.
 */
export const exportRoute = new Hono<AppEnv>().get("/", async (c) => {
  const db = c.get("db");
  const [cats, txs, buds, sets] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.sortOrder)),
    db.select().from(transactions).orderBy(asc(transactions.date), asc(transactions.id)),
    db.select().from(budgets),
    db.select().from(settings),
  ]);
  const day = new Date().toISOString().slice(0, 10);
  c.header("Content-Disposition", `attachment; filename="money-${day}.json"`);
  c.header("Cache-Control", "no-store");
  return c.json({
    version: 1,
    exportedAt: new Date().toISOString(),
    categories: cats,
    transactions: txs,
    budgets: buds,
    settings: Object.fromEntries(sets.map((s) => [s.key, JSON.parse(s.value)])),
  });
});
