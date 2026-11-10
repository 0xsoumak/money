import { newId } from "@money/shared";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import type { DB } from "./db";
import { authSchema } from "./db/schema";
import { hashPassword, verifyPassword } from "./lib/password";

const DAY = 60 * 60 * 24;

/** Built per request because Workers only expose bindings/secrets inside a request. */
export function createAuth(env: Env, db: DB) {
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    basePath: "/api/auth",
    database: drizzleAdapter(db, { provider: "sqlite", schema: authSchema }),
    emailAndPassword: {
      enabled: true,
      // Single-user app: the account is created with `pnpm create-user`, never via the API.
      disableSignUp: true,
      minPasswordLength: 12,
      password: { hash: hashPassword, verify: verifyPassword },
    },
    session: {
      expiresIn: 90 * DAY,
      updateAge: DAY, // rolling: any use after a day extends the session
    },
    rateLimit: {
      enabled: true,
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
      },
    },
    advanced: {
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      database: { generateId: () => newId() },
    },
    // Mobile sends `Authorization: Bearer <token>`; web uses the cookie.
    plugins: [bearer()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
