import {
  DEFAULT_SETTINGS,
  type Settings,
  settingsPatchSchema,
  settingsSchema,
} from "@money/shared";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import type { DB } from "../db";
import { settings } from "../db/schema";
import { validate } from "../lib/validate";
import type { AppEnv } from "../types";

async function readSettings(db: DB): Promise<Settings> {
  const rows = await db.select().from(settings);
  const stored = Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]));
  // Unknown or invalid stored keys fall back to defaults rather than breaking the app.
  const parsed = settingsSchema.partial().safeParse(stored);
  return { ...DEFAULT_SETTINGS, ...(parsed.success ? parsed.data : {}) };
}

export const settingsRoute = new Hono<AppEnv>()
  .get("/", async (c) => c.json({ settings: await readSettings(c.get("db")) }))

  .patch("/", validate("json", settingsPatchSchema), async (c) => {
    const db = c.get("db");
    const patch = Object.entries(c.req.valid("json")).filter(([, v]) => v !== undefined);
    await db
      .insert(settings)
      .values(patch.map(([key, value]) => ({ key, value: JSON.stringify(value) })))
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: sql`excluded.value`, updatedAt: new Date() },
      });
    return c.json({ settings: await readSettings(db) });
  });
