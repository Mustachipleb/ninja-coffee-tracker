import { db } from "./db.server";
import { hashPassword } from "./auth.server";
import { UserRole } from "~/types/roles";

declare global {
  // eslint-disable-next-line no-var
  var __adminBootstrap: Promise<void> | undefined;
}

/**
 * Create an admin user from the ADMIN_USERNAME/ADMIN_PASSWORD env vars, if
 * both are set and no user with that name already exists yet. This lets a
 * fresh Docker deployment (empty database) get a first admin account without
 * manual `db:seed`/Prisma Studio access. Existing users are never modified,
 * so this is safe to run on every container start.
 */
async function bootstrap(): Promise<void> {
  const username = process.env.ADMIN_USERNAME?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!username || !password) {
    return;
  }

  const existing = await db.user.findUnique({ where: { name: username } });
  if (existing) {
    console.log(`[bootstrap-admin] User "${username}" already exists; skipping.`);
    return;
  }

  const hashedPassword = await hashPassword(password);
  await db.user.create({
    data: { name: username, password: hashedPassword, role: UserRole.ADMIN },
  });
  console.log(
    `[bootstrap-admin] Created admin user "${username}" from ADMIN_USERNAME/ADMIN_PASSWORD.`,
  );
}

/**
 * Memoized so the bootstrap only runs once per server process, no matter how
 * many requests trigger it concurrently.
 */
export function ensureAdminUser(): Promise<void> {
  if (!global.__adminBootstrap) {
    global.__adminBootstrap = bootstrap().catch((error) => {
      console.error("[bootstrap-admin] Failed to create admin user:", error);
    });
  }
  return global.__adminBootstrap;
}
