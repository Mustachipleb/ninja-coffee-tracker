import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { deleteSession } from "~/lib/auth.server";
import { getCurrentUser, getLogoutCookie } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);

  if (user) {
    // Get session ID from cookie and delete it
    const cookies = request.headers.get("cookie") || "";
    const sessionId = parseCookie(cookies, "ninja-session");
    if (sessionId) {
      await deleteSession(sessionId);
    }
  }

  const cookie = getLogoutCookie();
  return redirect("/login", {
    headers: { "Set-Cookie": cookie },
  });
}

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
