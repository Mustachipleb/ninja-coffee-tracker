import { redirect } from "react-router";
import { getCurrentUserWithRole } from "./authorize.server";

const SESSION_COOKIE_NAME = "ninja-session";

/**
 * Whether the request reached us over HTTPS, checking `X-Forwarded-Proto`
 * first (set by TLS-terminating reverse proxies) and falling back to the
 * request URL's own protocol. Docker deployments are commonly exposed over
 * plain HTTP (no reverse proxy), where a browser will silently refuse to
 * store/send a `Secure` cookie set on a non-HTTPS, non-localhost origin —
 * breaking login. Only mark the cookie `Secure` when we can confirm HTTPS.
 */
function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
  }
  return new URL(request.url).protocol === "https:";
}

/**
 * Get current user from request cookies.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(request: Request): Promise<{
  id: string;
  name: string;
} | null> {
  const user = await getCurrentUserWithRole(request);
  if (!user) return null;
  return { id: user.id, name: user.name };
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
export function getSessionCookie(sessionId: string, request: Request): string {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const secure = isSecureRequest(request) ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly;${secure} SameSite=Strict; Expires=${expiresAt.toUTCString()}`;
}

/**
 * Get logout cookie header (deletes session cookie).
 */
export function getLogoutCookie(request: Request): string {
  const secure = isSecureRequest(request) ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
