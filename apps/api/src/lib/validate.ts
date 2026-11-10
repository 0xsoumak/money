import { zValidator } from "@hono/zod-validator";
import type { ValidationTargets } from "hono";
import { z } from "zod";

/** zValidator with a consistent 400 error body: { error, issues }. */
export function validate<T extends z.ZodType, Target extends keyof ValidationTargets>(
  target: Target,
  schema: T,
) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      return c.json({ error: "Invalid request", issues: z.flattenError(result.error) }, 400);
    }
  });
}

export const idParam = (idSchema: z.ZodType<string>) => z.object({ id: idSchema });
