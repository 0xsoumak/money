import { categoryCreateSchema, categoryUpdateSchema, idSchema, newId } from "@money/shared";
import { asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { categories } from "../db/schema";
import { idParam, validate } from "../lib/validate";
import type { AppEnv } from "../types";

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
    const [row] = await c
      .get("db")
      .insert(categories)
      .values({ id: newId(), ...input, sortOrder: input.sortOrder ?? 0 })
      .returning();
    return c.json({ category: row }, 201);
  })

  .patch(
    "/:id",
    validate("param", idParam(idSchema)),
    validate("json", categoryUpdateSchema),
    async (c) => {
      const { id } = c.req.valid("param");
      const { archived, ...fields } = c.req.valid("json");
      const [row] = await c
        .get("db")
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
