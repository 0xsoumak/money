/**
 * Create (or reset the password of) the single app user directly in D1.
 * Sign-up is disabled in the API, so this is the only way to get an account.
 *
 *   pnpm create-user --remote     # production D1
 *   pnpm create-user --local      # local dev D1 (default)
 *
 * Prompts for email, name and password. For scripted local use you can set
 * MT_EMAIL, MT_NAME and MT_PASSWORD instead.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createInterface } from "node:readline";
import { newId } from "@money/shared";
import { hashPassword } from "../src/lib/password";

const MIN_PASSWORD = 12;
const remote = process.argv.includes("--remote");

function ask(question: string, { hidden = false } = {}): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      // Swallow echoed characters while typing the password.
      const rlAny = rl as unknown as {
        _writeToOutput: (s: string) => void;
        output: NodeJS.WriteStream;
      };
      rlAny._writeToOutput = (s: string) => {
        if (s.includes(question)) rlAny.output.write(s);
        else if (s === "\r\n" || s === "\n") rlAny.output.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

const sqlString = (v: string) => `'${v.replaceAll("'", "''")}'`;

async function main() {
  console.log(`Creating user in ${remote ? "REMOTE (production)" : "local"} D1\n`);

  const email = (process.env.MT_EMAIL ?? (await ask("Email: "))).toLowerCase();
  const name = process.env.MT_NAME ?? ((await ask("Name: ")) || email.split("@")[0] || "Me");
  let password = process.env.MT_PASSWORD;
  if (!password) {
    password = await ask(`Password (min ${MIN_PASSWORD} chars): `, { hidden: true });
    const confirm = await ask("Confirm password: ", { hidden: true });
    if (password !== confirm) throw new Error("Passwords do not match");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email");
  if (password.length < MIN_PASSWORD)
    throw new Error(`Password must be at least ${MIN_PASSWORD} characters`);

  const hash = await hashPassword(password);
  const now = Date.now();
  const userId = newId();

  // Upsert by email: re-running resets the password and keeps the same user id.
  const sql = `
INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
VALUES (${sqlString(userId)}, ${sqlString(name)}, ${sqlString(email)}, 1, ${now}, ${now})
ON CONFLICT(email) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at;

DELETE FROM account WHERE provider_id = 'credential'
  AND user_id = (SELECT id FROM user WHERE email = ${sqlString(email)});

INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at)
SELECT ${sqlString(newId())}, id, 'credential', id, ${sqlString(hash)}, ${now}, ${now}
FROM user WHERE email = ${sqlString(email)};

DELETE FROM session WHERE user_id = (SELECT id FROM user WHERE email = ${sqlString(email)});
`;

  const dir = mkdtempSync(join(tmpdir(), "money-create-user-"));
  const file = join(dir, "create-user.sql");
  try {
    writeFileSync(file, sql);
    const wrangler = join(
      dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
      "bin",
      "wrangler.js",
    );
    execFileSync(
      process.execPath,
      [
        wrangler,
        "d1",
        "execute",
        "money",
        remote ? "--remote" : "--local",
        "--file",
        file,
        "--yes",
      ],
      { stdio: "inherit" },
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  console.log(`\n✅ User ${email} is ready. Existing sessions were signed out.`);
}

main().catch((err) => {
  console.error(`\n❌ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
