# Money Tracker

Personal expense tracker and budget app. See [plan.md](plan.md) for the roadmap.

- **API:** https://money-tracker.soumakkdutta.workers.dev/api (Hono on Cloudflare Workers + D1)
- **Web app:** same URL, served by the same Worker (`apps/web`, Vite + React + TanStack Router)
- **Android app:** `apps/mobile` (Expo, React Native). See below.
- **Repo:** `apps/api`, `apps/web`, `apps/mobile`, `packages/shared`

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
4. `npx wrangler login` once, for "Describe it" entries (Workers AI always runs on Cloudflare, even in dev)
5. `pnpm dev`, then open http://localhost:5173

## Notes

- Money is stored as integer minor units (paise). Dates are `YYYY-MM-DD` strings.
- Sign-up is disabled. `create-user` writes the account straight to D1.
- "Describe it" (type "spent 500 on dinner yesterday" in Add) uses Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`) on the free 10k neurons/day. The model only extracts fields; `packages/shared/src/entry.ts` validates them before anything is saved.
- Production secrets live in Cloudflare (`wrangler secret put BETTER_AUTH_SECRET`), never in the repo.

## Android app

Needs the **Expo Go** app on your phone and the same Wi-Fi as your PC. No Android Studio.

```
pnpm --filter @money/mobile start
```

Scan the QR code with Expo Go. The app signs in to the live API by default; set `EXPO_PUBLIC_API_URL` (for example in `apps/mobile/.env.local`) to use another server.
If the phone can't connect, add `--tunnel`, and allow Node through Windows Firewall on private networks.

### Installing it for real (APK and over-the-air updates)

Builds run in the cloud on EAS (free tier), so no Android SDK is needed. One-time setup, from `apps/mobile`:

```
pnpm eas login                 # your Expo account
pnpm eas init                  # creates the EAS project, writes its id into app.json
pnpm eas update:configure      # adds the update URL to app.json
```

Then:

| Command          | What it does                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `pnpm build:apk` | Builds a release APK (about 15 min). Open the link it prints on your phone and install it.                      |
| `pnpm ota`       | Ships JS and design changes to installed apps in seconds, no rebuild. The app picks them up on its next launch. |

`runtimeVersion` uses the **fingerprint** policy: an update only reaches APKs whose native code matches. After adding a native library (like Reanimated), run `pnpm build:apk` again; `pnpm ota` alone won't reach older APKs, so it can never crash them.
