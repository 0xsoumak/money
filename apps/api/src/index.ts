import { Hono } from "hono";
import { createAuth } from "./auth";
import { createDb } from "./db";
import { analyticsRoute } from "./routes/analytics";
import { budgetsRoute } from "./routes/budgets";
import { categoriesRoute } from "./routes/categories";
import { exportRoute } from "./routes/export";
import { settingsRoute } from "./routes/settings";
import { summaryRoute } from "./routes/summary";
import { transactionsRoute } from "./routes/transactions";
import type { AppEnv } from "./types";

/** Everything here requires a signed-in session. */
const protectedApi = new Hono<AppEnv>()
  .route("/categories", categoriesRoute)
  .route("/transactions", transactionsRoute)
  .route("/budgets", budgetsRoute)
  .route("/summary", summaryRoute)
  .route("/analytics", analyticsRoute)
  .route("/settings", settingsRoute)
  .route("/export", exportRoute);

const app = new Hono<AppEnv>()
  .use("/api/*", async (c, next) => {
    const db = createDb(c.env.DB);
    c.set("db", db);
    c.set("auth", createAuth(c.env, db));
    await next();
  })

  .get("/api/health", (c) => c.json({ ok: true }))

  .on(["GET", "POST"], "/api/auth/*", (c) => c.get("auth").handler(c.req.raw))

  .use("/api/*", async (c, next) => {
    const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
    if (!session) return c.json({ error: "Unauthorized" }, 401);
    c.set("userId", session.user.id);
    await next();
  })

  .route("/api", protectedApi);

app.notFound((c) => c.json({ error: "Not found" }, 404));

app.onError((err, c) => {
  // Structured so Workers Observability can filter by path and search messages.
  console.error(
    JSON.stringify({
      level: "error",
      method: c.req.method,
      path: c.req.path,
      message: err.message,
      stack: err.stack,
    }),
  );
  return c.json({ error: "Internal server error" }, 500);
});

export default app;

/** Used by the web and mobile clients: `hc<AppType>(baseUrl)`. */
export type AppType = typeof app;
