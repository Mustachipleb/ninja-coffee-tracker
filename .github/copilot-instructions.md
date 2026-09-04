# Ninja Coffee Tracker — Copilot Instructions

Full-stack app (React Router v7 framework mode + Prisma/SQLite) for a friend
group sharing a Ninja Luxe Premier coffee machine to log brews and split costs.

## Commands

- `npm run dev` — Vite dev server with HMR (http://localhost:5173).
- `npm run build` — production client+server bundles.
- `npm run start` — run the production build (build first).
- `npm run typecheck` — `react-router typegen && tsc` (regenerates route types
  under `.react-router/` before type-checking; run this after changing any
  loader/action signature or route config).
- `npm run db:migrate` — `prisma migrate dev` (creates/updates `prisma/dev.db`).
- `npm run db:seed` — `prisma db seed` (runs `prisma/seed.ts` via tsx).
- `npm run db:studio` — Prisma Studio.

There is no test suite and no linter configured — `typecheck` is the primary
validation step after code changes.

## Architecture

- **Routes** are registered explicitly in `app/routes.ts` (not filesystem
  routing) — adding a page means adding both the file in `app/routes/` and an
  entry in `routes.ts`. `routes/login.tsx` and `routes/logout.tsx` sit outside
  the shared `layout("routes/layout.tsx", [...])` group; every other route is
  nested inside it and rendered through its `<Outlet />`.
- Each route file colocates its `loader`/`action`/default component (React
  Router v7 convention), typed via generated `./+types/<route-name>` imports.
  Actions commonly dispatch on a hidden `intent` form field (e.g. `"create"`,
  `"delete"`) rather than using separate routes per operation.
- **`*.server.ts` suffix** marks server-only modules (db access, auth, cost
  aggregation) that must never be imported from client-rendered code paths.
- **Auth**: `app/lib/session.server.ts` (cookie helpers, `requireAuth`) and
  `app/lib/authorize.server.ts` (`requireRole`, `getCurrentUserWithRole`,
  per-feature `canDeleteX`/`canManageX` checks) layer session-cookie auth
  (`ninja-session`, Argon2id-hashed passwords in `auth.server.ts`) with a
  `UserRole` (`USER`/`ADMIN`) enum from `app/types/roles.ts`. Loaders/actions
  call `requireAuth`/`requireRole` explicitly per route — there is no global
  auth middleware. The session cookie's `Secure` attribute is only set when
  the request is actually HTTPS (via `X-Forwarded-Proto` or the request URL);
  hardcoding `Secure` breaks login when the app is exposed over plain HTTP
  (e.g. a bare Docker deployment on a LAN IP, where only `localhost`/loopback
  get a browser exception).
- **Admin bootstrap**: `app/lib/bootstrap-admin.server.ts` creates a first
  `ADMIN` user from `ADMIN_USERNAME`/`ADMIN_PASSWORD` env vars if neither is
  empty and no user with that name exists yet; it never modifies an existing
  user. It's invoked (memoized per server process) from the root loader in
  `app/root.tsx`, so it runs lazily on first request rather than at container
  boot.
- **Cost model**: costs are computed on the fly, never stored. Bean cost is
  `gramsForBasket(basketSize) * (bean.priceCents / bean.weightGrams)`
  (`app/lib/basket-size.ts` maps `BasketSize` → grind grams: Single 9g,
  Double 18g, Luxe 40g); milk cost is
  `(milkVolumeMl / 1000) * milkType.pricePerLiterCents`. Both live in
  `app/lib/cost.ts`. Because costs derive from the *current* bean/milk price,
  editing a price only affects future brews, not history — Prisma relations
  use `onDelete: Restrict` for `Bean`/`MilkType` referenced by any `Brew` or
  `FavoriteSetting` so that cost history can't be silently invalidated.
- All money fields are stored as integer cents (`priceCents`,
  `pricePerLiterCents`, `amountCents`) and formatted for display via
  `app/lib/format.ts` (EUR currency, dates, grams) — never store or compare
  floating-point currency values.
- `prisma/schema.prisma` is the source of truth for the data model (`User`,
  `Session`, `Bean`, `MilkType`, `Brew`, `FavoriteSetting`, `AppSettings`,
  `Payment`); the generated client outputs to `generated/prisma` (custom
  `output` path, not `node_modules/.prisma`), imported via `app/lib/db.server.ts`.
- Per-user cost/balance aggregation (bean+milk cost minus payments) lives in
  `app/lib/cost-summary.server.ts` and `app/lib/reconciliation.server.ts`,
  consumed by `routes/costs.tsx` and `routes/payments.tsx`.

## Deployment

`Dockerfile` builds the app and, on container start, runs
`prisma migrate deploy` against the SQLite file before starting the server.
The database lives at `/data/coffee.db` inside the container — mount a
volume over `/data` (not `/app/prisma`, which only holds the schema/migrations
baked into the image) to persist it across restarts. Optionally set
`ADMIN_USERNAME`/`ADMIN_PASSWORD` to auto-create a first admin user (see
`app/lib/bootstrap-admin.server.ts` above). CI
(`.github/workflows/docker-build.yml`) builds/pushes the image to GHCR on
pushes to `main` when `Dockerfile`, `package*.json`, `prisma/**`, `app/**`, or
`public/**` change.
