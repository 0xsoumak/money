import { applyD1Migrations, env } from "cloudflare:test";
import { hashPassword } from "../src/lib/password";
import { TEST_USER } from "./helpers";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);

const hash = await hashPassword(TEST_USER.password);
const now = Date.now();
await env.DB.batch([
  env.DB.prepare(
    "INSERT OR IGNORE INTO user (id, name, email, email_verified, created_at, updated_at) VALUES (?, ?, ?, 1, ?, ?)",
  ).bind(TEST_USER.id, "Test", TEST_USER.email, now, now),
  env.DB.prepare(
    "INSERT OR IGNORE INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES (?, ?, 'credential', ?, ?, ?, ?)",
  ).bind("01KQTESTACCOUNT00000000000", TEST_USER.id, TEST_USER.id, hash, now, now),
]);
