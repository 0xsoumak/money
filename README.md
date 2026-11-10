# Money Tracker

Personal expense tracker and budget app. See [plan.md](plan.md) for the roadmap.

- **API:** https://money-tracker.soumakkdutta.workers.dev/api (Hono on Cloudflare Workers + D1)
- **Web app:** same URL, served by the same Worker (`apps/web`, Vite + React + TanStack Router)
- **Repo:** `apps/api`, `apps/web`, `packages/shared` (Android app comes later, see plan.md)

## Commands (from the repo root)

| Command                                            | What it does                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------- |
| `pnpm install`                                     | Install everything                                                   |
| `pnpm dev`                                         | Run API (port 8787) and web together. Open http://localhost:5173     |
| `pnpm build`                                       | Build the web app                                                    |
| `pnpm test`                                        | Run all tests                                                        |
| `pnpm typecheck` / `pnpm lint` / `pnpm format`     | Checks and formatting                                                |
| `pnpm ship`                                        | Apply new migrations, build the web app, deploy API + web            |
| `pnpm db:generate`                                 | Generate a migration after changing `apps/api/src/db/schema.ts`      |
| `pnpm db:migrate:local` / `pnpm db:migrate:remote` | Apply migrations                                                     |
| `pnpm create-user --local` / `--remote`            | Create the user, or reset its password (also signs out all sessions) |

## Local setup

1. `cp apps/api/.dev.vars.example apps/api/.dev.vars` and set a random `BETTER_AUTH_SECRET`
2. `pnpm db:migrate:local`
3. `pnpm create-user --local`
4. `pnpm dev`, then open http://localhost:5173

## Notes

- Money is stored as integer minor units (paise). Dates are `YYYY-MM-DD` strings.
- Sign-up is disabled. `create-user` writes the account straight to D1.
- Production secrets live in Cloudflare (`wrangler secret put BETTER_AUTH_SECRET`), never in the repo.
