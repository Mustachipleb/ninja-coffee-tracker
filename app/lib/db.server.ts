// Load DATABASE_URL (and any other vars) from .env when running outside of
// Vite dev (e.g. `npm start`), where env files aren't loaded automatically.
import "dotenv/config";
import { PrismaClient } from "../../generated/prisma/client";

// Reuse a single PrismaClient across HMR reloads in dev so we don't exhaust
// SQLite connections / open many file handles to dev.db.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const db = global.__prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.__prisma = db;
}
