import { z } from "zod";
import { isValidDate, isValidMonth } from "./dates";
import { MAX_MINOR } from "./money";

// ── Primitives ──────────────────────────────────────────────────────────────

/** Crockford base32 ULID, as produced by `newId()`. */
export const idSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "Invalid id");

/** Positive integer amount in minor units (paise/cents). */
export const amountSchema = z.number().int().positive().max(MAX_MINOR);

export const dateSchema = z.string().refine(isValidDate, "Expected a date as YYYY-MM-DD");
export const monthSchema = z.string().refine(isValidMonth, "Expected a month as YYYY-MM");

export const transactionTypeSchema = z.enum(["expense", "income"]);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/** Category color keys. Actual color values live in the design tokens (Phase 0). */
export const CATEGORY_COLORS = [
  "coral",
  "amber",
  "lime",
  "mint",
  "teal",
  "sky",
  "indigo",
  "violet",
  "pink",
  "slate",
] as const;
export const categoryColorSchema = z.enum(CATEGORY_COLORS);
export type CategoryColor = z.infer<typeof categoryColorSchema>;

// ── Categories ──────────────────────────────────────────────────────────────

export const categoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().trim().min(1).max(16),
  color: categoryColorSchema,
  kind: transactionTypeSchema,
  sortOrder: z.number().int().min(0).max(10_000).optional(),
});
export type CategoryCreate = z.infer<typeof categoryCreateSchema>;

export const categoryUpdateSchema = categoryCreateSchema
  .omit({ kind: true })
  .partial()
  .extend({ archived: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export type CategoryUpdate = z.infer<typeof categoryUpdateSchema>;

// ── Transactions ────────────────────────────────────────────────────────────

export const transactionInputSchema = z.object({
  type: transactionTypeSchema,
  amount: amountSchema,
  categoryId: idSchema,
  date: dateSchema,
  note: z.string().trim().max(500).nullish(),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const monthQuerySchema = z.object({ month: monthSchema });

// ── Settings ────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  currency: z.string().regex(/^[A-Z]{3}$/, "Expected an ISO 4217 code like INR"),
  locale: z.string().min(2).max(35),
  weekStart: z.enum(["monday", "sunday"]),
});
export type Settings = z.infer<typeof settingsSchema>;

export const settingsPatchSchema = settingsSchema
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");

export const DEFAULT_SETTINGS: Settings = {
  currency: "INR",
  locale: "en-IN",
  weekStart: "monday",
};
