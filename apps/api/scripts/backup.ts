/**
 * Back up the D1 database to the repo's `backups/` folder (git-ignored).
 *
 *   pnpm backup            # production D1
 *   pnpm backup --local    # local dev D1
 *
 * Writes two files:
 *   money-<date>.sql   full SQL dump (wrangler d1 export). Restore with
 *                      `wrangler d1 execute money --remote --file <it>` into an empty database.
 *   money-<date>.json  the app data only (categories, transactions, budgets, settings),
 *                      readable anywhere. No auth tables, so no password hashes or sessions.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const remote = !process.argv.includes("--local");
const where = remote ? "--remote" : "--local";
const here = dirname(fileURLToPath(import.meta.url));
const apiDir = resolve(here, "..");
const outDir = resolve(apiDir, "../../backups");
const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
const base = join(outDir, `money-${remote ? "" : "local-"}${stamp}`);

const wrangler = join(
  dirname(createRequire(import.meta.url).resolve("wrangler/package.json")),
  "bin",
  "wrangler.js",
);
const run = (args: string[]) =>
  execFileSync(process.execPath, [wrangler, ...args], {
    cwd: apiDir,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });

mkdirSync(outDir, { recursive: true });

console.log(`Exporting SQL (${remote ? "production" : "local"})…`);
run(["d1", "export", "money", where, "--output", `${base}.sql`]);
writeFileSync(`${base}.sql`, restoreOrder(readFileSync(`${base}.sql`, "utf8")));

const TABLES = ["categories", "transactions", "budgets", "settings"] as const;
const data: Record<string, unknown[]> = {};
for (const table of TABLES) {
  const out = run([
    "d1",
    "execute",
    "money",
    where,
    "--json",
    "--command",
    `select * from ${table}`,
  ]);
  const parsed = JSON.parse(out) as { results: unknown[] }[];
  data[table] = parsed[0]?.results ?? [];
}
writeFileSync(
  `${base}.json`,
  `${JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)}\n`,
);

const counts = TABLES.map((t) => `${data[t]?.length ?? 0} ${t}`).join(", ");
console.log(`Saved ${base}.sql and .json (${counts})`);

/**
 * `wrangler d1 export` writes each table's CREATE followed by its rows, in
 * name order, so `account` rows land before the `user` table they reference
 * exists and the dump fails to restore into an empty database. Put every
 * CREATE TABLE first, then the rows, then indexes and the rest.
 */
function restoreOrder(sql: string): string {
  const starts = /^(PRAGMA |CREATE |INSERT INTO |DELETE FROM |UPDATE )/;
  const statements: string[] = [];
  for (const line of sql.split("\n")) {
    if (starts.test(line) || statements.length === 0) statements.push(line);
    else statements[statements.length - 1] += `\n${line}`;
  }
  const rank = (st: string) =>
    st.startsWith("PRAGMA ")
      ? 0
      : st.startsWith("CREATE TABLE")
        ? 1
        : st.startsWith("INSERT INTO ") || st.startsWith("DELETE FROM ") || st.startsWith("UPDATE ")
          ? 2
          : 3;
  // Array.sort is stable, so statements keep their order within each group.
  return `${statements
    .map((st) => st.trimEnd())
    .filter(Boolean)
    .sort((a, b) => rank(a) - rank(b))
    .join("\n")}\n`;
}
