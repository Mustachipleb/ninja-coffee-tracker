import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/users";
import { db } from "~/lib/db.server";

export async function loader() {
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { brews: true, favorites: true } } },
  });
  return { users };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") ?? "").trim();
    if (!name) {
      return data({ error: "Name is required." }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { name } });
    if (existing) {
      return data({ error: `"${name}" is already in the group.` }, { status: 400 });
    }
    await db.user.create({ data: { name } });
    return redirect("/users");
  }

  if (intent === "delete") {
    const userId = String(formData.get("userId") ?? "");
    await db.user.delete({ where: { id: userId } });
    return redirect("/users");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Users({ loaderData, actionData }: Route.ComponentProps) {
  const { users } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-gray-500">
          Everyone in the friend group who brews (and pays for) coffee.
        </p>
      </div>

      <Form method="post" className="flex items-end gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="flex-1">
          <label htmlFor="name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Sam"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <button
          type="submit"
          name="intent"
          value="create"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Add person
        </button>
      </Form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {users.length === 0 && (
          <li className="p-4 text-sm text-gray-500">No one has been added yet.</li>
        )}
        {users.map((user) => (
          <li key={user.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-gray-500">
                {user._count.brews} brew{user._count.brews === 1 ? "" : "s"} ·{" "}
                {user._count.favorites} favorite{user._count.favorites === 1 ? "" : "s"}
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                name="intent"
                value="delete"
                className="text-sm text-red-600 hover:underline"
                onClick={(event) => {
                  if (!confirm(`Remove ${user.name} and all their brews/favorites?`)) {
                    event.preventDefault();
                  }
                }}
              >
                Remove
              </button>
            </Form>
          </li>
        ))}
      </ul>
    </div>
  );
}
