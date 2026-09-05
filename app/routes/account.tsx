import { data, Form, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/account";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/session.server";
import { hashPassword, verifyPassword } from "~/lib/auth.server";
import { MIN_PASSWORD_LENGTH } from "~/lib/password";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAuth(request);
  return { user };
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAuth(request);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "change-password") {
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!currentPassword || !newPassword || !confirmPassword) {
      return data({ error: "All fields are required." }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return data(
        { error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 },
      );
    }
    if (newPassword !== confirmPassword) {
      return data({ error: "New password and confirmation do not match." }, { status: 400 });
    }

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });
    if (!dbUser?.password || !(await verifyPassword(currentPassword, dbUser.password))) {
      return data({ error: "Current password is incorrect." }, { status: 401 });
    }

    const hashedPassword = await hashPassword(newPassword);
    await db.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    return redirect("/account?changed=1");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Account({ loaderData, actionData }: Route.ComponentProps) {
  const { user } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const [searchParams] = useSearchParams();
  const changed = searchParams.get("changed") === "1";

  return (
    <div className="mx-auto max-w-xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-gray-500">
          Signed in as <span className="font-medium">{user.name}</span>. Change your password
          below.
        </p>
      </div>

      {changed && !error && (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
          Password changed successfully.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950">{error}</p>
      )}

      <Form
        method="post"
        className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium">
            Current password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type="password"
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium">
            New password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium">
            Confirm new password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <button
          type="submit"
          name="intent"
          value="change-password"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Change password
        </button>
      </Form>
    </div>
  );
}
