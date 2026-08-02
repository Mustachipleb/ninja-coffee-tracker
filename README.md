# Ninja Coffee Tracker ☕

A full-stack app for a small friend group sharing a **Ninja Luxe Premier** to
track who brewed what, which beans they used, and how much each person owes.

## Tech stack

- [React Router v7](https://reactrouter.com/) in framework (full-stack) mode — SSR, file-based route config, loaders/actions.
- [Prisma ORM](https://www.prisma.io/) + **SQLite** for data storage.
- Tailwind CSS v4 for styling.

## Features

- **Log brews** for anyone in the group, including the exact machine settings used: grind amount (grams), whether frothed milk was added, and brew style (Classic, Rich, Over Ice, Specialty, Cold Brew).
- **Register bags of beans** with their weight and price (or price/weight), and see how many grams are left in each bag as brews are logged against it.
- **Cost tracking** — each brew's cost is derived from the price-per-gram of the beans it used, so the app can show a running total (and per-bag breakdown) of what everyone owes.
- **Favorite settings** — save named presets per person (e.g. "Morning Latte") so a new brew can be filled in with one click.

## Data model (`prisma/schema.prisma`)

| Model             | Purpose                                                                 |
| ------------------ | ------------------------------------------------------------------------ |
| `User`             | A person in the friend group.                                          |
| `Bean`             | A loaded bag of beans: name, roaster, weight (g), total price (cents). |
| `Brew`             | A single logged cup: user, bean, grind grams, milk froth, brew style.  |
| `FavoriteSetting`  | A labeled, saved combination of brew settings for a user.              |

Costs are computed on the fly as `grindAmountGrams * (bean.priceCents / bean.weightGrams)`, so editing a bag's price only affects brews going forward from that recalculation, not stored history.

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
    brews.tsx        # Log a brew + recent brew history
    beans.tsx        # Register bags of beans, see remaining grams
    favorites.tsx    # Manage saved per-user brew presets
    users.tsx        # Manage the friend group
    costs.tsx        # Per-person and per-bag cost breakdowns
  lib/
    db.server.ts     # Prisma client singleton
    beans.server.ts  # Bean-with-usage query helper
    cost-summary.server.ts # Per-user cost aggregation
    cost.ts          # Pure cost math (price/gram, brew cost)
    brew-style.ts    # BrewStyle enum labels/options
    format.ts        # Currency/date/gram formatting helpers
prisma/
  schema.prisma      # Data model (SQLite datasource)
  seed.ts            # Sample data seed script
```

## Deployment

The included `Dockerfile` builds the app and, on container start, runs
`prisma migrate deploy` against a SQLite file before starting the server.
Mount a volume over `/app/prisma` to persist data across restarts:

```bash
docker build -t ninja-coffee-tracker .
docker run -p 3000:3000 -v ninja-coffee-data:/app/prisma ninja-coffee-tracker
```
