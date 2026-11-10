# Money Tracker — Plan

A personal monthly expense tracker and budgeting app for one user, with a web app and an Android app.

**Guiding principle:** keep it simple. Logging an expense must take seconds. Each phase ends with something usable. New features come only after the basics are a daily habit.

---

## Decisions

| Area            | Choice                                                                                                                                               |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repo            | pnpm workspaces monorepo                                                                                                                             |
| Backend         | **Hono** on a single Cloudflare Worker                                                                                                               |
| Database        | **Cloudflare D1** (SQLite) + **Drizzle ORM**, migrations through Drizzle Kit and `wrangler d1 migrations apply`                                      |
| Auth            | **Better Auth**, email/password, sign-ups disabled after the first account. Cookies on web, bearer token on mobile.                                  |
| Web             | **Vite + React + TanStack Router + TanStack Query**, a pure SPA with no SSR                                                                          |
| Web hosting     | Static build served by the **same Worker** (Workers static assets), so one origin and no CORS                                                        |
| Mobile          | **Expo** (React Native), Android only, installed locally from an APK. **EAS Update** for over-the-air JS updates.                                    |
| API client      | Hono RPC (`hc<AppType>`), typed end to end in both clients                                                                                           |
| Validation      | Zod schemas shared in `packages/shared`                                                                                                              |
| Styling         | Our own small component kit. Tailwind on web (headless behavior from **Base UI** or **React Aria**), **NativeWind** on mobile. Design tokens shared. |
| Motion and feel | Motion on web, Reanimated on mobile, `expo-haptics`, `@gorhom/bottom-sheet`                                                                          |
| Cost            | ₹0. Everything fits in the Cloudflare and Expo free tiers.                                                                                           |

### Data rules (set from day one)

- **Money is stored as integers** in minor units (paise): `12550` = ₹125.50. Never floats.
- **Transaction dates are plain local dates** (`'2026-11-10'`), not UTC timestamps, so monthly grouping is never off by a timezone. `created_at` and `updated_at` are timestamps used only for sorting and auditing.
- **The client generates IDs** (ULID), which makes creates idempotent and leaves room for offline support later.
- **Soft delete** (`deleted_at`), so deleting shows an Undo toast instead of a confirm dialog.
- **Single currency**, stored in settings and formatted with `Intl.NumberFormat`.
- **No accounts in v1.** The `account_id` column is nullable and unused for now.

---

## Repo layout

```
money-tracker/
├─ apps/
│  ├─ api/       Hono + Better Auth + Drizzle/D1. Serves /api/* and the web build.
│  ├─ web/       Vite + React + TanStack Router/Query (SPA, builds to dist/)
│  └─ mobile/    Expo app (Android)
├─ packages/
│  └─ shared/    zod schemas, types, money/date helpers, default categories, design tokens
├─ plan.md
└─ pnpm-workspace.yaml
```

`apps/api/wrangler.jsonc`, in brief:

```jsonc
{
  "assets": {
    "directory": "../web/dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  },
  "d1_databases": [{ "binding": "DB", "database_name": "money", "database_id": "..." }],
  "observability": { "enabled": true }
}
```

---

## Data model (v1)

```
user / session / account / verification   ← managed by Better Auth

categories
  id            text pk (ulid)
  name          text
  emoji         text
  color         text          -- token key, e.g. "coral"
  kind          text          -- 'expense' | 'income'
  sort_order    integer
  archived_at   integer null
  created_at, updated_at

transactions
  id            text pk (ulid, client-generated)
  type          text          -- 'expense' | 'income'
  amount        integer       -- minor units, always positive
  category_id   text fk
  date          text          -- 'YYYY-MM-DD'
  note          text null
  account_id    text null     -- reserved, unused in v1
  created_at, updated_at, deleted_at null
  index (date), index (category_id, date)

budgets
  id            text pk
  category_id   text null     -- null = overall monthly budget
  amount        integer       -- monthly limit, minor units
  created_at, updated_at
  unique (category_id)

settings
  key           text pk       -- 'currency', 'locale', 'week_start', ...
  value         text
```

Budgets are a monthly limit per category plus an optional overall limit. They have no rollover and apply to every month until changed.

---

## API (v1)

All routes are under `/api`, and all except auth require a session.

```
/api/auth/*                         Better Auth handler

GET    /api/categories
POST   /api/categories
PATCH  /api/categories/:id
DELETE /api/categories/:id          (archive)

GET    /api/transactions?month=YYYY-MM
PUT    /api/transactions/:id        (idempotent create-or-update, client ULID)
DELETE /api/transactions/:id        (soft delete)
POST   /api/transactions/:id/restore

GET    /api/summary?month=YYYY-MM   totals: spent, income, by category, budget progress

GET    /api/budgets
PUT    /api/budgets/:categoryId|overall
DELETE /api/budgets/:categoryId|overall

GET    /api/settings
PATCH  /api/settings

GET    /api/export?format=csv|json
```

---

## Phases

### Phase 0: Design direction ✅

Choose the look before writing UI code.

- [x] Mock up 3 visual directions (home, quick add, web dashboard each) and compare. **Picked B: Bold & high-contrast.**
- [x] Define the **design tokens**: light and dark palettes, category colors, radii, spacing, type scale, motion, meter rules (`packages/shared/src/tokens.ts`, contrast-tested)
- [x] List the core components and states, plus the visualization rules (`docs/design.md`)

**Done when:** tokens are in `packages/shared/src/tokens.ts` and there is a reference mockup to build against.

---

### Phase 1: Foundation and API (3–5 days)

A deployed, secured API on a real URL.

- [x] Set up the monorepo: pnpm workspaces, TypeScript base config, Biome or ESLint + Prettier, `.gitignore`, `git init`
- [x] `packages/shared`: zod schemas, money helpers (`parseAmount`, `fromMinor`, `formatMoney`), date helpers (`monthOf`, `monthRange`, `today()` in local time) (tokens added in Phase 0)
- [x] `apps/api`: Hono app, Drizzle schema, first migration, create the D1 database (local and remote)
- [x] Better Auth: email/password, D1 adapter, bearer plugin for mobile, **rate limiting on**, session ~90 days with rolling renewal
- [ ] Sign-ups are disabled in the API; the account is created with `pnpm create-user --remote` (writes straight to D1, password never leaves the machine) ← **you: run this once**
- [x] Seed default categories and settings in a migration (`0001_seed_defaults.sql`)
- [x] Endpoints: categories, transactions, summary, settings (budgets and export come later)
- [x] Auth middleware on all `/api/*` except `/api/auth/*`
- [x] Secrets set with `wrangler secret put` (`BETTER_AUTH_SECRET`, …)
- [x] Tests for the API with Vitest + `@cloudflare/vitest-plugin` (money math, month boundaries, auth guard, idempotent PUT)
- [x] `wrangler deploy` to `money-tracker.soumakkdutta.workers.dev`

**Done when:** I can log in and create and list transactions on the deployed API with curl or a REST client, and an unauthenticated request gets a 401.

---

### Phase 2: Web app ✅ (built and deployed; use it for a week before moving on)

Web goes first, so there is something usable on a real URL (and on the phone browser) while mobile waits. **Dark theme only for now**; the light tokens exist but no light UI is built.

- [x] `apps/web`: Vite + React + TanStack Router (file routes) + TanStack Query, Tailwind v4 wired to the shared tokens, our own components on Base UI, Space Grotesk
- [x] Vite dev server proxies `/api` to `wrangler dev`; typed API client (`hc<AppType>`)
- [x] Login (cookie session, same origin); redirect to login on 401
- [x] Overview: big month total, income, month switcher, share bar by category, grouped transaction list
- [x] **Quick add** (dialog): amount, category pills, date, note. `N` opens it, `Enter` saves. Client-generated ID, optimistic update.
- [x] Edit a transaction; delete with an **Undo toast** (soft delete + restore)
- [x] Transactions page: filter by month, type, category and text
- [x] Categories page: add, edit, archive; emoji and color picker
- [x] Settings page: currency, locale; sign out
- [x] Keyboard: `N` new, `←`/`→` change month
- [x] Usable at phone width (stacked layout), since it doubles as a phone fallback
- [x] Serve the build from the same Worker (`assets` in `wrangler.jsonc`); one command deploys everything (`pnpm deploy`)

**Done when:** the web app is live at the Worker URL, I can log in and log, edit and delete an expense, and the numbers match the API.

---

### Phase 3: Budgets (3–5 days)

- [ ] API: budget endpoints, budget progress in `/api/summary`
- [ ] Web: **Budgets** page to set a monthly limit per category plus an optional overall limit
- [ ] Block meters (calm → warning at 80% → danger over 100%, always with words like "₹60 over")
- [ ] Overview shows "left to spend" against the overall budget, and the dashed "left" segment on the share bar

**Done when:** at a glance I can see how much I have left this month, overall and per category.

---

### Phase 4: Android app (later, 1–2 weeks)

Starts after the web app has been used for a while. Reuses the API, shared package, tokens and design guide.

- [ ] Expo app with Expo Router, NativeWind wired to the shared tokens (dark only), development build on my phone (not Expo Go)
- [ ] Typed API client (`hc`) + TanStack Query; bearer token kept in `expo-secure-store`
- [ ] Login, Overview (month view), Budgets
- [ ] **Quick add**: opens to a number pad and category pills. Amount → category → save in three taps. Haptic on every key and on save.
- [ ] Edit, delete with Undo toast, Categories screen
- [ ] Failed saves are kept and retried (safe because of the client ULIDs)
- [ ] App icon, splash screen, name; `runtimeVersion` policy and EAS Update channel
- [ ] Build a release APK (EAS cloud build or local Gradle) and install it

**Done when:** I've used it for a full week to log every expense, and adding one takes under 5 seconds.

---

### Phase 5: Polish and reliability (ongoing, ~3–5 days)

- [ ] Motion pass: springy sheets, count-up amounts, list item enter/exit, bar fills
- [ ] Empty states and first-run experience (friendly, not blank)
- [ ] Accessibility check: contrast in both themes, touch targets ≥ 44px, screen reader labels on amounts
- [ ] **Backups**: confirm D1 Time Travel restore works (7 days on the free plan), add a `pnpm backup` script that runs `wrangler d1 export` to a local `.sql` file, and export JSON monthly
- [ ] Error handling: friendly error toasts, Workers Observability logs checked
- [ ] Performance: month queries hit indexes, lists virtualized if needed

**Done when:** nothing feels rough in daily use, and I've restored a backup once to prove it works.

---

### Phase 6+: Later (only after v1 is a habit)

Rough priority order:

1. **Recurring transactions**: rent and subscriptions added automatically each month (Cron Trigger or created when the app opens)
2. **Android shortcut / widget**: long-press the app icon → "Add expense", then perhaps a home-screen widget
3. **Insights**: month-over-month comparison, top categories, spending trend
4. **Investments**: holdings with manually updated values (no live prices at first), net worth over time
5. **Accounts**: cash, bank and card, with transfers (uses the reserved `account_id`)
6. **Full offline-first sync** on mobile
7. Custom domain, search, tags, receipts/attachments (R2)

---

## Working agreements

- Each phase ends deployed and usable. No long-running branches.
- Don't add a feature until I've felt its absence in real use.
- Migrations are committed and always applied through Wrangler. Never edit the remote DB by hand.
- Keep shared logic (money, dates, validation) in `packages/shared` with tests.
