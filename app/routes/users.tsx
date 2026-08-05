import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/users";
import { db } from "~/lib/db.server";
import { requireAuth } from "~/lib/session.server";
import { getCurrentUserWithRole, requireRole, isAdmin } from "~/lib/authorize.server";
import { UserRole } from "~/types/roles";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  await requireRole(request, UserRole.ADMIN);
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { brews: true, favorites: true } } },
  });
  return { users };
}

export async function action({ request }: Route.ActionArgs) {
  const currentUser = await getCurrentUserWithRole(request);
  if (!currentUser) throw redirect("/login");
  if (!isAdmin(currentUser)) {
    return data({ error: "Only admins can manage users." }, { status: 403 });
  }

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
    await db.user.create({ data: { name, role: UserRole.USER } });
    return redirect("/users");
  }

  if (intent === "delete") {
    const userId = String(formData.get("userId") ?? "");
    
    // Prevent self-deletion
    if (userId === currentUser.id) {
      return data({ error: "You cannot delete your own account." }, { status: 400 });
    }

    // Check if target user is an admin - admins cannot delete other admins
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (targetUser && targetUser.role === UserRole.ADMIN) {
      return data({ error: "Admins cannot delete other admins." }, { status: 403 });
    }

    await db.user.delete({ where: { id: userId } });
    return redirect("/users");
  }

  if (intent === "set-role") {
    const userId = String(formData.get("userId") ?? "");
    const role = String(formData.get("role") ?? "");

    // Prevent self-role-change
    if (userId === currentUser.id) {
      return data({ error: "You cannot change your own role." }, { status: 400 });
    }

    if (!Object.values(UserRole).includes(role as UserRole)) {
      return data({ error: "Invalid role." }, { status: 400 });
    }

    // Prevent promoting/demoting other admins
    const targetUser = await db.user.findUnique({ where: { id: userId } });
    if (targetUser && targetUser.role === UserRole.ADMIN) {
      return data({ error: "Only other admins can change an admin's role." }, { status: 403 });
    }

    await db.user.update({
      where: { id: userId },
      data: { role: role as UserRole },
    });
    return redirect("/users");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Users({ loaderData, actionData }: Route.ComponentProps) {
  const { users } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">People</h1>
        <p className="text-sm text-gray-500">
          Everyone in the friend group who brews (and pays for) coffee. Manage roles and members.
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

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Activity</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="p-4 text-center text-gray-500">
                  No one has been added yet.
                </td>
              </tr>
            )}
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3">
                  <Form method="post" className="inline">
                    <input type="hidden" name="userId" value={user.id} />
                    <select
                      name="role"
                      defaultValue={user.role}
                      onChange={(e) => {
                        e.currentTarget.form?.requestSubmit();
                      }}
                      className="rounded border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900"
                    >
                      <option value="USER">User</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <input type="hidden" name="intent" value="set-role" />
                  </Form>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {user._count.brews} brew{user._count.brews === 1 ? "" : "s"} ·{" "}
                  {user._count.favorites} favorite{user._count.favorites === 1 ? "" : "s"}
                </td>
                <td className="px-4 py-3 text-right">
                  <Form method="post" className="inline">
                    <input type="hidden" name="userId" value={user.id} />
                    <button
                      type="submit"
                      name="intent"
                      value="delete"
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                      disabled={user.role === "ADMIN"}
                      onClick={(event) => {
                        if (!confirm(`Remove ${user.name} and all their brews/favorites?`)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {user.role === "ADMIN" ? "Cannot remove admin" : "Remove"}
                    </button>
                  </Form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
