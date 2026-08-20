import { redirect } from "react-router";
import { db } from "./db.server";
import { getCookieValue } from "./cookies.server";
import { UserRole } from "~/types/roles";

export interface AuthorizedUser {
  id: string;
  name: string;
  role: UserRole;
}

/**
 * Get the current user with their role from session.
 * Returns null if not authenticated.
 */
export async function getCurrentUserWithRole(
  request: Request,
): Promise<AuthorizedUser | null> {
  const sessionId = getCookieValue(
    request.headers.get("cookie"),
    "ninja-session",
  );

  if (!sessionId) return null;

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: {
      user: {
        select: { id: true, name: true, role: true },
      },
    },
  });

  if (!session) return null;

  // Check if expired
  if (new Date() > session.expiresAt) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return session.user as AuthorizedUser;
}

/**
 * Require authentication with a specific role.
 * Redirects to login if not authenticated.
 * Throws 403 error if user lacks required role.
 */
export async function requireRole(
  request: Request,
  requiredRole: UserRole,
): Promise<AuthorizedUser> {
  const user = await getCurrentUserWithRole(request);

  if (!user) {
    throw redirect("/login");
  }

  if (requiredRole === UserRole.ADMIN && user.role !== UserRole.ADMIN) {
    throw new Response("Forbidden: Admin access required", { status: 403 });
  }

  return user;
}

/**
 * Check if user is admin.
 */
export function isAdmin(user: AuthorizedUser): boolean {
  return user.role === UserRole.ADMIN;
}

/**
 * Check if user can delete a brew.
 * Users can delete their own brews, admins can delete any.
 */
export async function canDeleteBrew(
  user: AuthorizedUser,
  brewId: string,
): Promise<boolean> {
  if (isAdmin(user)) return true;

  const brew = await db.brew.findUnique({
    where: { id: brewId },
    select: { userId: true },
  });

  return brew?.userId === user.id;
}

/**
 * Check if user can manage a bean.
 * Only admins can delete beans.
 * Anyone can add beans.
 */
export function canDeleteBean(user: AuthorizedUser): boolean {
  return isAdmin(user);
}

/**
 * Check if user can manage a milk type.
 * Only admins can delete milk types.
 * Anyone can add milk types.
 */
export function canDeleteMilkType(user: AuthorizedUser): boolean {
  return isAdmin(user);
}

/**
 * Check if user can manage another user.
 * Only admins can do this.
 */
export function canManageUsers(user: AuthorizedUser): boolean {
  return isAdmin(user);
}

/**
 * Check if user can see/manage all balances.
 * Only admins can see all; users see only their own.
 */
export function canSeeAllBalances(user: AuthorizedUser): boolean {
  return isAdmin(user);
}

/**
 * Check if user can change global settings.
 * Only admins can do this.
 */
export function canChangeSettings(user: AuthorizedUser): boolean {
  return isAdmin(user);
}
