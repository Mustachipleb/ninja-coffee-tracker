import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/milks";
import { db } from "~/lib/db.server";
import { formatCents } from "~/lib/format";
import { getMilkTypesWithUsage } from "~/lib/milk.server";
import { requireAuth } from "~/lib/session.server";
import { canDeleteMilkType } from "~/lib/authorize.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const milkTypes = await getMilkTypesWithUsage();
  return { milkTypes };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    await requireAuth(request);
    const name = String(formData.get("name") ?? "").trim();
    const pricePerLiter = Number(formData.get("pricePerLiter"));

    if (!name) {
      return data({ error: "Please provide a milk name." }, { status: 400 });
    }
    if (!Number.isFinite(pricePerLiter) || pricePerLiter < 0) {
      return data({ error: "Please provide a valid price per liter." }, { status: 400 });
    }

    const existing = await db.milkType.findUnique({ where: { name } });
    if (existing) {
      return data({ error: `"${name}" is already registered.` }, { status: 400 });
    }

    await db.milkType.create({
      data: { name, pricePerLiterCents: Math.round(pricePerLiter * 100) },
    });
    return redirect("/milks");
  }

  if (intent === "delete") {
    const { getCurrentUserWithRole } = await import("~/lib/authorize.server");
    const user = await getCurrentUserWithRole(request);
    if (!user) throw redirect("/login");
    if (!canDeleteMilkType(user)) {
      return data({ error: "Only admins can delete milk types." }, { status: 403 });
    }

    const milkTypeId = String(formData.get("milkTypeId") ?? "");
    try {
      await db.milkType.delete({ where: { id: milkTypeId } });
    } catch {
      return data(
        { error: "That milk is used by existing brews/favorites, so it can't be deleted." },
        { status: 400 },
      );
    }
    return redirect("/milks");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Milks({ loaderData, actionData }: Route.ComponentProps) {
  const { milkTypes } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Milk types</h1>
        <p className="text-sm text-gray-500">
          Register the milks available for frothing, along with their price per liter.
        </p>
      </div>

      <Form
        method="post"
        className="flex items-end gap-2 rounded-lg border border-gray-200 p-4 dark:border-gray-800"
      >
        <div className="flex-1">
          <label htmlFor="name" className="block text-sm font-medium">
            Milk name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Whole milk"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="pricePerLiter" className="block text-sm font-medium">
            Price per liter (€)
          </label>
          <input
            id="pricePerLiter"
            name="pricePerLiter"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="1.20"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <button
          type="submit"
          name="intent"
          value="create"
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          Add milk
        </button>
      </Form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {milkTypes.length === 0 && (
          <li className="p-4 text-sm text-gray-500">No milk types registered yet.</li>
        )}
        {milkTypes.map((milk) => (
          <li key={milk.id} className="flex items-center justify-between p-4">
            <div>
              <p className="font-medium">{milk.name}</p>
              <p className="text-xs text-gray-500">
                {formatCents(milk.pricePerLiterCents)}/L · used in {milk._count.brews} brew
                {milk._count.brews === 1 ? "" : "s"} · {milk._count.favorites} favorite
                {milk._count.favorites === 1 ? "" : "s"}
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="milkTypeId" value={milk.id} />
              <button
                type="submit"
                name="intent"
                value="delete"
                className="text-sm text-red-600 hover:underline"
                onClick={(event) => {
                  if (!confirm(`Delete "${milk.name}"?`)) {
                    event.preventDefault();
                  }
                }}
              >
                Delete
              </button>
            </Form>
          </li>
        ))}
      </ul>
    </div>
  );
}
