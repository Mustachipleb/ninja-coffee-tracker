import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/login";
import { authenticateUser, createSession } from "~/lib/auth.server";
import { getSessionCookie, getCurrentUser } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  // If already logged in, redirect to home
  const user = await getCurrentUser(request);
  if (user) {
    return redirect("/");
  }
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const formData = await request.formData();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!name || !password) {
    return data({ error: "Name and password are required." }, { status: 400 });
  }

  const userId = await authenticateUser(name, password);
  if (!userId) {
    return data({ error: "Invalid name or password." }, { status: 401 });
  }

  const sessionId = await createSession(userId);
  const cookie = getSessionCookie(sessionId, request);

  return redirect("/", {
    headers: { "Set-Cookie": cookie },
  });
}

export default function Login({ actionData }: Route.ComponentProps) {
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">☕ Ninja Coffee Tracker</h1>
        <p className="mt-2 text-sm text-gray-500">Track group coffee brewing and costs</p>
      </div>

      <Form method="post" className="w-full space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoComplete="username"
            placeholder="e.g., Alex, Bri, Cass"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-lg bg-amber-700 px-4 py-2.5 text-base font-semibold text-white hover:bg-amber-800"
        >
          Sign in
        </button>
      </Form>

      <p className="text-center text-xs text-gray-500">
        (Demo: use your name and any password to log in)
      </p>
    </div>
  );
}
