import { redirect } from "react-router";
import type { Route } from "./+types/logout";
import { deleteSession } from "~/lib/auth.server";
import { getCookieValue } from "~/lib/cookies.server";
import { getCurrentUser, getLogoutCookie } from "~/lib/session.server";

export async function action({ request }: Route.ActionArgs) {
  const user = await getCurrentUser(request);

  if (user) {
    // Get session ID from cookie and delete it
    const sessionId = getCookieValue(
      request.headers.get("cookie"),
      "ninja-session",
    );
    if (sessionId) {
      await deleteSession(sessionId);
    }
  }

  const cookie = getLogoutCookie(request);
  return redirect("/login", {
    headers: { "Set-Cookie": cookie },
  });
}
