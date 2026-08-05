import { redirect } from "react-router";
import { getUserFromSession } from "./auth.server";

const SESSION_COOKIE_NAME = "ninja-session";

/**
 * Get current user from request cookies.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(request: Request): Promise<{
  id: string;
  name: string;
} | null> {
  const cookies = request.headers.get("cookie") || "";
  const sessionId = parseCookie(cookies, SESSION_COOKIE_NAME);

  if (!sessionId) return null;

  return getUserFromSession(sessionId);
}

/**
 * Require authentication. Redirect to login if not authenticated.
 */
export async function requireAuth(
  request: Request,
): Promise<{ id: string; name: string }> {
  const user = await getCurrentUser(request);
  if (!user) {
    throw redirect("/login");
  }
  return user;
}

/**
 * Get session cookie header for setting session in response.
 */
export function getSessionCookie(sessionId: string): string {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

/**
 * Get logout cookie header (deletes session cookie).
 */
export function getLogoutCookie(): string {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Parse a specific cookie from the cookie header string.
 */
function parseCookie(cookieHeader: string, name: string): string | null {
  const cookies = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .reduce(
      (acc, c) => {
        const [key, value] = c.split("=");
        acc[key] = decodeURIComponent(value || "");
        return acc;
      },
      {} as Record<string, string>,
    );

  return cookies[name] || null;
}
