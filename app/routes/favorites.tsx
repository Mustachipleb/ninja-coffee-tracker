import { useState } from "react";
import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/favorites";
import { db } from "~/lib/db.server";
import { BREW_STYLE_OPTIONS, BREW_STYLE_LABELS, BrewStyle, isBrewStyle } from "~/lib/brew-style";

export async function loader() {
  const [users, favorites] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.favoriteSetting.findMany({
      include: { user: true },
      orderBy: [{ user: { name: "asc" } }, { label: "asc" }],
    }),
  ]);
  return { users, favorites };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const userId = String(formData.get("userId") ?? "");
    const label = String(formData.get("label") ?? "").trim();
    const grindAmountGrams = Number(formData.get("grindAmountGrams"));
    const milkFrothed = formData.get("milkFrothed") === "on";
    const brewStyleRaw = String(formData.get("brewStyle") ?? "");

    if (!userId || !label) {
      return data({ error: "Please choose a person and a label." }, { status: 400 });
    }
    if (!Number.isFinite(grindAmountGrams) || grindAmountGrams <= 0) {
      return data({ error: "Grind amount must be a positive number of grams." }, { status: 400 });
    }
    if (!isBrewStyle(brewStyleRaw)) {
      return data({ error: "Please choose a valid brew style." }, { status: 400 });
    }

    const existing = await db.favoriteSetting.findUnique({
      where: { userId_label: { userId, label } },
    });
    if (existing) {
      return data({ error: `That person already has a favorite called "${label}".` }, { status: 400 });
    }

    await db.favoriteSetting.create({
      data: { userId, label, grindAmountGrams, milkFrothed, brewStyle: brewStyleRaw as BrewStyle },
    });
    return redirect("/favorites");
  }

  if (intent === "delete") {
    const favoriteId = String(formData.get("favoriteId") ?? "");
    await db.favoriteSetting.delete({ where: { id: favoriteId } });
    return redirect("/favorites");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Favorites({ loaderData, actionData }: Route.ComponentProps) {
  const { users, favorites } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  const [grindAmountGrams, setGrindAmountGrams] = useState(18);
  const [milkFrothed, setMilkFrothed] = useState(false);
  const [brewStyle, setBrewStyle] = useState<BrewStyle>(BrewStyle.CLASSIC);

  const favoritesByUser = new Map<string, typeof favorites>();
  for (const favorite of favorites) {
    const list = favoritesByUser.get(favorite.userId) ?? [];
    list.push(favorite);
    favoritesByUser.set(favorite.userId, list);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Favorite settings</h1>
        <p className="text-sm text-gray-500">
          Save go-to brew settings per person so they can be re-applied in one click when logging a brew.
        </p>
      </div>

      <Form method="post" className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 dark:border-gray-800">
        <div>
          <label htmlFor="userId" className="block text-sm font-medium">
            Person
          </label>
          <select
            id="userId"
            name="userId"
            required
            defaultValue={users[0]?.id ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {users.length === 0 && <option value="">Add a person first</option>}
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="label" className="block text-sm font-medium">
            Label
          </label>
          <input
            id="label"
            name="label"
            required
            placeholder="e.g. Morning Latte"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="grindAmountGrams" className="block text-sm font-medium">
            Grind amount (grams)
          </label>
          <input
            id="grindAmountGrams"
            name="grindAmountGrams"
            type="number"
            step="0.1"
            min="0.1"
            required
            value={grindAmountGrams}
            onChange={(event) => setGrindAmountGrams(Number(event.target.value))}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>

        <div>
          <label htmlFor="brewStyle" className="block text-sm font-medium">
            Brew style
          </label>
          <select
            id="brewStyle"
            name="brewStyle"
            required
            value={brewStyle}
            onChange={(event) => setBrewStyle(event.target.value as BrewStyle)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {BREW_STYLE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end pb-2">
          <label htmlFor="milkFrothed" className="flex items-center gap-2 text-sm font-medium">
            <input
              id="milkFrothed"
              name="milkFrothed"
              type="checkbox"
              checked={milkFrothed}
              onChange={(event) => setMilkFrothed(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            Frothed milk added
          </label>
        </div>

        <div className="sm:col-span-2">
          <button
            type="submit"
            name="intent"
            value="create"
            disabled={users.length === 0}
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
          >
            Save favorite
          </button>
        </div>
      </Form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="space-y-6">
        {users.length === 0 && <p className="text-sm text-gray-500">Add people to start saving favorites.</p>}
        {users.map((user) => {
          const userFavorites = favoritesByUser.get(user.id) ?? [];
          if (userFavorites.length === 0) return null;
          return (
            <div key={user.id}>
              <h2 className="mb-2 text-lg font-semibold">{user.name}</h2>
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
                {userFavorites.map((favorite) => (
                  <li key={favorite.id} className="flex items-center justify-between gap-4 p-4">
                    <div>
                      <p className="font-medium">{favorite.label}</p>
                      <p className="text-xs text-gray-500">
                        {favorite.grindAmountGrams}g · {BREW_STYLE_LABELS[favorite.brewStyle]}
                        {favorite.milkFrothed ? " · with frothed milk" : ""}
                      </p>
                    </div>
                    <Form method="post">
                      <input type="hidden" name="favoriteId" value={favorite.id} />
                      <button
                        type="submit"
                        name="intent"
                        value="delete"
                        className="text-sm text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </Form>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
