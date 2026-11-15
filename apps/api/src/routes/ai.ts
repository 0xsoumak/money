import {
  buildEntryPrompt,
  ENTRY_JSON_SCHEMA,
  entryRequestSchema,
  interpretEntryReply,
} from "@money/shared";
import { asc, eq, isNull } from "drizzle-orm";
import { Hono } from "hono";
import { categories, transactions } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

/** Accurate enough to pick the right category; about 20 neurons a request, ~500 a day free. */
const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const AI_DOWN =
  "The AI isn't available right now (the free daily limit may be used up). Add it manually.";

export const aiRoute = new Hono<AppEnv>()
  /**
   * "spent 500 on dinner yesterday" → a saved transaction. The client sends its own id, so a
   * retried request returns the same row instead of asking the model (and saving) twice.
   * Failures are 422 with a message the app shows as-is.
   */
  .post("/entry", validate("json", entryRequestSchema), async (c) => {
    const { id, text, today } = c.req.valid("json");
    const db = c.get("db");

    const already = await db.query.transactions.findFirst({ where: eq(transactions.id, id) });
    if (already) return c.json({ transaction: already });

    const usable = await db
      .select({ id: categories.id, name: categories.name, kind: categories.kind })
      .from(categories)
      .where(isNull(categories.archivedAt))
      .orderBy(asc(categories.kind), asc(categories.sortOrder));

    let raw: unknown;
    try {
      const out = await c.env.AI.run(MODEL, {
        messages: buildEntryPrompt(text, today, usable),
        response_format: { type: "json_schema", json_schema: ENTRY_JSON_SCHEMA },
        max_tokens: 120,
        temperature: 0,
      });
      raw = (out as { response?: unknown }).response;
    } catch (err) {
      // Most likely the free daily allowance is used up (resets 00:00 UTC).
      console.error(
        JSON.stringify({ level: "error", path: c.req.path, message: (err as Error).message }),
      );
      return c.json({ error: AI_DOWN }, 422);
    }

    const result = interpretEntryReply(raw, usable, today);
    if (!result.ok) return c.json({ error: result.error }, 422);

    const [row] = await db
      .insert(transactions)
      .values({ id, ...result.input })
      .onConflictDoNothing()
      .returning();
    if (row) return c.json({ transaction: row });
    // A retry of this same request won the race and saved it first.
    const saved = await db.query.transactions.findFirst({ where: eq(transactions.id, id) });
    if (!saved) throw new Error("AI entry was neither inserted nor found");
    return c.json({ transaction: saved });
  });
