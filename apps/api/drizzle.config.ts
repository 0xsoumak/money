import { defineConfig } from "drizzle-kit";

// Drizzle only generates SQL files here; Wrangler applies them (`pnpm db:migrate:local|remote`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./migrations",
});
