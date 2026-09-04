# Ninja Coffee Tracker ☕

A full-stack app for a small friend group sharing a **Ninja Luxe Premier** to
track who brewed what, which beans they used, and how much each person owes.

## Tech stack

- [React Router v7](https://reactrouter.com/) in framework (full-stack) mode — SSR, file-based route config, loaders/actions.
- [Prisma ORM](https://www.prisma.io/) + **SQLite** for data storage.
- Tailwind CSS v4 for styling.

## Features

- **Log brews** for anyone in the group, including the exact machine settings used: basket size (Single ~9g, Double ~18g, Luxe ~40g — matching the Ninja Luxe Premier's own presets), an optional milk type + volume (ml), and brew style (Classic, Rich, Over Ice, Specialty, Cold Brew).
- **Register bags of beans** with their weight and price (or price/weight), and see how many grams are left in each bag as brews are logged against it.
- **Register milk types** with their own price per liter (e.g. whole milk, oat milk), so milk cost can be tracked alongside bean cost.
- **Cost tracking** — each brew's cost is derived from the price-per-gram of the beans it used (based on the basket size's grind weight) plus the price-per-liter of any milk used, so the app can show a running total (and per-bag/per-milk breakdown) of what everyone owes, all in euros (€).
- **Favorite settings** — save named presets per person (e.g. "Morning Latte"), including basket size and milk choice, so a new brew can be filled in with one click.

## Data model (`prisma/schema.prisma`)

| Model             | Purpose                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `User`             | A person in the friend group.                                          |
| `Bean`             | A loaded bag of beans: name, roaster, weight (g), total price (cents). |
| `MilkType`         | A type of milk: name, price per liter (cents).                        |
| `Brew`             | A single logged cup: user, bean, basket size, optional milk type + volume (ml), brew style. |
| `FavoriteSetting`  | A labeled, saved combination of brew settings (incl. basket size and milk) for a user. |

Costs are computed on the fly. Bean cost is `gramsForBasket(basketSize) * (bean.priceCents / bean.weightGrams)`, where `gramsForBasket` maps each basket size to its approximate grind weight (Single 9g, Double 18g, Luxe 40g). Milk cost is `(milkVolumeMl / 1000) * milkType.pricePerLiterCents`. Because both are computed live from the *current* bean/milk price, editing a bag's or milk's price only affects brews going forward, not stored history — and beans/milk types that are referenced by any brew or favorite can't be deleted, to keep that cost history meaningful.

## Getting started

Install dependencies:

```bash
npm install
```

Apply the database schema (creates `prisma/dev.db`):

```bash
npm run db:migrate
```

Optionally load sample data (a few people, bags of beans, favorites, and brews):

```bash
npm run db:seed
```

Start the dev server:

```bash
npm run dev
```

The app is available at `http://localhost:5173`.

## Scripts

| Script              | What it does                                              |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Start the Vite dev server with HMR.                        |
| `npm run build`      | Build client + server bundles for production.              |
| `npm run start`      | Run the production build (`npm run build` first).          |
| `npm run typecheck`  | Generate route types and run `tsc`.                        |
| `npm run db:migrate` | Create/apply a Prisma migration (`prisma migrate dev`).    |
| `npm run db:seed`    | Seed the database with sample data.                        |
| `npm run db:studio`  | Open Prisma Studio to browse/edit data.                    |

## Project structure

```
app/
  routes/
    layout.tsx      # Nav shell shared by every page
    home.tsx         # Dashboard: totals, recent brews, low-bean warnings
    brews.tsx        # Log a brew (basket size + milk) + recent brew history
    beans.tsx        # Register bags of beans, see remaining grams
    milks.tsx        # Register milk types and their price per liter
    favorites.tsx    # Manage saved per-user brew presets (incl. milk)
    users.tsx        # Manage the friend group
    costs.tsx        # Per-person, per-bag, and per-milk cost breakdowns
  lib/
    db.server.ts     # Prisma client singleton
    beans.server.ts  # Bean-with-usage query helper
    milk.server.ts   # Milk-type-with-usage query helper
    cost-summary.server.ts # Per-user cost aggregation
    cost.ts          # Pure cost math (bean cost, milk cost, brew cost)
    basket-size.ts   # BasketSize enum labels/options/grams mapping
    brew-style.ts    # BrewStyle enum labels/options
    format.ts        # Currency (EUR)/date/gram formatting helpers
prisma/
  schema.prisma      # Data model (SQLite datasource)
  seed.ts            # Sample data seed script
```

## Deployment

The included `Dockerfile` builds the app and, on container start, runs
`prisma migrate deploy` against a SQLite file before starting the server.
The database lives at `/data/coffee.db` inside the container — mount a
volume over `/data` to persist it across restarts/recreations.

Set `ADMIN_USERNAME` and `ADMIN_PASSWORD` to have the app create a first
admin user automatically on startup (skipped if a user with that name
already exists), so a fresh deployment doesn't require manual database
access to get an initial login.

```bash
docker build -t ninja-coffee-tracker .
docker run -p 3000:3000 \
  -v ninja-coffee-data:/data \
  -e ADMIN_USERNAME=admin \
  -e ADMIN_PASSWORD=change-me \
  ninja-coffee-tracker
```

> [!NOTE]
> The session cookie is only marked `Secure` when the request is actually
> HTTPS (checked via `X-Forwarded-Proto` behind a reverse proxy, or the
> request URL otherwise) — see `app/lib/session.server.ts`. This lets login
> work when the container is exposed directly over plain HTTP (e.g. on a
> LAN IP without TLS), while still using `Secure` cookies automatically once
> you put it behind an HTTPS-terminating reverse proxy.
