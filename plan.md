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

### Phase 0: Design direction (1–2 days)

Choose the look before writing UI code.

- [ ] Mock up 2–3 visual directions (for example soft and playful, bold and high-contrast, calm and minimal) as a comparison page: home/month view, quick add, budgets
- [ ] Pick one and define the **design tokens**: color palette (light and dark), category color set, radii, spacing, shadows, font (with tabular figures for numbers)
- [ ] List the core components and their states: Button, AmountDisplay, NumberPad, CategoryChip, BottomSheet/Dialog, ListRow, ProgressBar, Tabs, Toast, TextField, MonthSwitcher

**Done when:** tokens are in `packages/shared/tokens.ts` and there is a reference mockup to build against.

---

### Phase 1: Foundation and API (3–5 days)

A deployed, secured API on a real URL.

- [x] Set up the monorepo: pnpm workspaces, TypeScript base config, Biome or ESLint + Prettier, `.gitignore`, `git init`
- [x] `packages/shared`: zod schemas, money helpers (`parseAmount`, `fromMinor`, `formatMoney`), date helpers (`monthOf`, `monthRange`, `today()` in local time) (tokens come with Phase 0)
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

### Phase 2: Mobile MVP (1–2 weeks)

The app I'll use every day. Most of the effort goes into making quick add feel great.

- [ ] Expo app with Expo Router, NativeWind wired to the shared tokens, light and dark mode
- [ ] Development build on my phone (not Expo Go)
- [ ] Typed API client (`hc`) + TanStack Query; token kept in `expo-secure-store`
- [ ] **Login** screen
- [ ] **Home / month view**: big "spent this month" figure, income, remaining (once budgets exist), list grouped by day, month switcher (swipe or arrows)
- [ ] **Quick add**: opens straight to a number pad and category chips. Amount → category → save in three taps. Date defaults to today, note optional. Haptic on every key and on save.
- [ ] Edit a transaction (tap a row → same sheet, prefilled)
- [ ] Delete with an **Undo toast** (soft delete + restore)
- [ ] **Categories** screen: add, edit, reorder, archive; emoji and color picker
- [ ] Failed saves are kept and retried (safe because of the client ULIDs). The user is never left with a lost entry.
- [ ] App icon, splash screen, name
- [ ] `runtimeVersion` policy set; EAS Update channel configured
- [ ] Build a release APK (EAS cloud build or local Gradle) and install it

**Done when:** I've used it for a full week to log every expense, and adding one takes under 5 seconds.

---

### Phase 3: Budgets (3–5 days)

- [ ] API: budget endpoints, budget progress in `/api/summary`
- [ ] Mobile: **Budgets** screen to set a monthly limit per category plus an optional overall limit
- [ ] Animated progress bars on budget cards, with color moving from calm → warning (>80%) → over (>100%)
- [ ] Home screen shows "left to spend this month" against the overall budget
- [ ] Category breakdown on the month view (simple bars or a donut)

**Done when:** at a glance I can see how much I have left this month, overall and per category.

---

### Phase 4: Web app (1 week)

For reviewing, bulk editing and exporting on a bigger screen.

- [ ] `apps/web`: Vite + React + TanStack Router (file routes) + TanStack Query, Tailwind with the shared tokens, our own components built on Base UI or React Aria
- [ ] Vite dev server proxies `/api` to `wrangler dev`
- [ ] Login (cookie session, same origin)
- [ ] Dashboard: month summary, budget cards, category breakdown
- [ ] Transactions table: filter by month, category and text, then edit or delete inline
- [ ] Manage categories and budgets
- [ ] Settings: currency, export (CSV/JSON)
- [ ] Keyboard shortcuts: `n` for a new transaction, `←`/`→` to change month
- [ ] Responsive enough to use on the phone browser in a pinch
- [ ] Deploy script: `pnpm build:web && wrangler deploy` (one command from the root)

**Done when:** the web app is live at the same Worker URL and shows the same data as mobile.

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
