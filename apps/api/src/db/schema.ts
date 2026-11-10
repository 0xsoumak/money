import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`)
    .$onUpdateFn(() => new Date()),
};

// ── Better Auth tables ──────────────────────────────────────────────────────
// Property names must match Better Auth's field names; column names are ours.

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  ...timestamps,
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    ...timestamps,
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ...timestamps,
  },
  (t) => [index("verification_identifier_idx").on(t.identifier)],
);

export const rateLimit = sqliteTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: integer("last_request").notNull(),
});

export const authSchema = { user, session, account, verification, rateLimit };

// ── App tables ──────────────────────────────────────────────────────────────
// Single-user app: rows are not scoped by user. Auth only gates access.

export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  emoji: text("emoji").notNull(),
  color: text("color").notNull(),
  kind: text("kind", { enum: ["expense", "income"] }).notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
  ...timestamps,
});

export const transactions = sqliteTable(
  "transactions",
  {
    /** ULID generated on the client so retries are idempotent. */
    id: text("id").primaryKey(),
    type: text("type", { enum: ["expense", "income"] }).notNull(),
    /** Minor units (paise), always positive. `type` carries the direction. */
    amount: integer("amount").notNull(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    /** Local calendar date, "YYYY-MM-DD". */
    date: text("date").notNull(),
    note: text("note"),
    /** Reserved for accounts (post-v1). */
    accountId: text("account_id"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    ...timestamps,
  },
  (t) => [
    index("transactions_date_idx").on(t.date),
    index("transactions_category_date_idx").on(t.categoryId, t.date),
  ],
);

/** Monthly spending limits. `key` is "overall" or a category id; applies to every month, no rollover. */
export const budgets = sqliteTable("budgets", {
  key: text("key").primaryKey(),
  /** Null for the overall budget. */
  categoryId: text("category_id").references(() => categories.id),
  /** Minor units, always positive. */
  amount: integer("amount").notNull(),
  ...timestamps,
});

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  /** JSON-encoded value. */
  value: text("value").notNull(),
  updatedAt: timestamps.updatedAt,
});

export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
