# Money Tracker

Personal expense tracker and budget app. See [plan.md](plan.md) for the roadmap.

- **API:** https://money-tracker.soumakkdutta.workers.dev/api (Hono on Cloudflare Workers + D1)
- **Repo:** `apps/api`, `packages/shared` (web and mobile come in later phases)

## Commands (from the repo root)

| Command                                            | What it does                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm install`                                     | Install everything                                                   |
| `pnpm dev`                                         | Run the API locally at http://localhost:8787                         |
| `pnpm test`                                        | Run all tests                                                        |
| `pnpm typecheck` / `pnpm lint` / `pnpm format`     | Checks and formatting                                                |
| `pnpm deploy`                                      | Deploy the Worker                                                    |
| `pnpm db:generate`                                 | Generate a migration after changing `apps/api/src/db/schema.ts`      |
| `pnpm db:migrate:local` / `pnpm db:migrate:remote` | Apply migrations                                                     |
| `pnpm create-user --local` / `--remote`            | Create the user, or reset its password (also signs out all sessions) |

## Local setup

1. `cp apps/api/.dev.vars.example apps/api/.dev.vars` and set a random `BETTER_AUTH_SECRET`
2. `pnpm db:migrate:local`
3. `pnpm create-user --local`
4. `pnpm dev`

## Notes

- Money is stored as integer minor units (paise). Dates are `YYYY-MM-DD` strings.
- Sign-up is disabled. `create-user` writes the account straight to D1.
- Production secrets live in Cloudflare (`wrangler secret put BETTER_AUTH_SECRET`), never in the repo.
