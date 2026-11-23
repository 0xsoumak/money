import {
  categoryCreateSchema,
  categoryOrderSchema,
  categoryUpdateSchema,
  idSchema,
  newId,
} from "@money/shared";
import { and, asc, eq, isNull, max, ne, sql } from "drizzle-orm";
import { Hono } from "hono";
import { categories } from "../db/schema";
import { idParam, validate } from "../lib/validate";
import type { AppEnv } from "../types";

type Db = AppEnv["Variables"]["db"];

/**
 * An active category of this kind already using this name (ignoring case and spaces at the
 * ends), other than `except`. Two pickers chips reading "Coffee" can't be told apart.
 */
async function nameTaken(db: Db, kind: string, name: string, except?: string) {
  const row = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.kind, kind as "expense"),
        isNull(categories.archivedAt),
        sql`lower(trim(${categories.name})) = ${name.trim().toLowerCase()}`,
        except ? ne(categories.id, except) : undefined,
      ),
    )
    .get();
  return !!row;
}

const taken = (name: string) => `You already have a category called “${name.trim()}”.`;

export const categoriesRoute = new Hono<AppEnv>()
  /** All categories, including archived ones (clients hide those from pickers). */
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select()
      .from(categories)
      .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
    return c.json({ categories: rows });
  })

  .post("/", validate("json", categoryCreateSchema), async (c) => {
    const input = c.req.valid("json");
    const db = c.get("db");
    if (await nameTaken(db, input.kind, input.name))
      return c.json({ error: taken(input.name) }, 409);
    // Without an explicit order, a new category goes to the end of its kind.
    let sortOrder = input.sortOrder;
    if (sortOrder === undefined) {
      const [top] = await db
        .select({ value: max(categories.sortOrder) })
        .from(categories)
        .where(eq(categories.kind, input.kind));
      sortOrder = (top?.value ?? -1) + 1;
    }
    const [row] = await db
      .insert(categories)
      .values({ id: newId(), ...input, sortOrder })
      .returning();
    return c.json({ category: row }, 201);
  })

  /** Reorders categories: each id's position in the list becomes its sortOrder. */
  .put("/order", validate("json", categoryOrderSchema), async (c) => {
    const { ids } = c.req.valid("json");
    const db = c.get("db");
    const now = new Date();
    const updates = ids.map((id, i) =>
      db.update(categories).set({ sortOrder: i, updatedAt: now }).where(eq(categories.id, id)),
    );
    // One batch, so the order is never left half-applied. The schema guarantees at least one id.
    await db.batch(updates as [(typeof updates)[number], ...typeof updates]);
    const rows = await db
      .select()
      .from(categories)
      .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name));
    return c.json({ categories: rows });
  })

  .patch(
    "/:id",
    validate("param", idParam(idSchema)),
    validate("json", categoryUpdateSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { archived, ...fields } = c.req.valid("json");
      const db = c.get("db");
      // Renaming, or bringing one back from the archive, mustn't make a second of the same name.
      if (fields.name !== undefined || archived === false) {
        const current = await db.query.categories.findFirst({ where: eq(categories.id, id) });
        if (!current) return c.json({ error: "Category not found" }, 404);
        const name = fields.name ?? current.name;
        const active = archived === false || !current.archivedAt;
        if (active && (await nameTaken(db, current.kind, name, id)))
          return c.json({ error: taken(name) }, 409);
      }
      const [row] = await db
        .update(categories)
        .set({
          ...fields,
          ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
          updatedAt: new Date(),
        })
        .where(eq(categories.id, id))
        .returning();
      if (!row) return c.json({ error: "Category not found" }, 404);
      return c.json({ category: row });
    },
  )

  /** Archive, never hard-delete: past transactions still reference the category. */
  .delete("/:id", validate("param", idParam(idSchema)), async (c) => {
    const { id } = c.req.valid("param");
    const [row] = await c
      .get("db")
      .update(categories)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    if (!row) return c.json({ error: "Category not found" }, 404);
    return c.json({ category: row });
  });
