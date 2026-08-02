import { useState } from "react";
import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/favorites";
import { db } from "~/lib/db.server";
import { formatCents } from "~/lib/format";
import { BREW_STYLE_OPTIONS, BREW_STYLE_LABELS, BrewStyle, isBrewStyle } from "~/lib/brew-style";
import { BASKET_SIZE_OPTIONS, BASKET_SIZE_LABELS, BasketSize, isBasketSize } from "~/lib/basket-size";

const DEFAULT_MILK_VOLUME_ML = 100;

export async function loader() {
  const [users, milkTypes, favorites] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    db.milkType.findMany({ orderBy: { name: "asc" } }),
    db.favoriteSetting.findMany({
      include: { user: true, milkType: true },
      orderBy: [{ user: { name: "asc" } }, { label: "asc" }],
    }),
  ]);
  return { users, milkTypes, favorites };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const userId = String(formData.get("userId") ?? "");
    const label = String(formData.get("label") ?? "").trim();
    const basketSizeRaw = String(formData.get("basketSize") ?? "");
    const milkTypeId = String(formData.get("milkTypeId") ?? "").trim();
    const milkVolumeMl = Number(formData.get("milkVolumeMl"));
    const brewStyleRaw = String(formData.get("brewStyle") ?? "");

    if (!userId || !label) {
      return data({ error: "Please choose a person and a label." }, { status: 400 });
    }
    if (!isBasketSize(basketSizeRaw)) {
      return data({ error: "Please choose a valid basket size." }, { status: 400 });
    }
    if (!isBrewStyle(brewStyleRaw)) {
      return data({ error: "Please choose a valid brew style." }, { status: 400 });
    }
    if (milkTypeId && (!Number.isFinite(milkVolumeMl) || milkVolumeMl <= 0)) {
      return data({ error: "Please provide a positive milk volume (ml)." }, { status: 400 });
    }

    const existing = await db.favoriteSetting.findUnique({
      where: { userId_label: { userId, label } },
    });
    if (existing) {
      return data({ error: `That person already has a favorite called "${label}".` }, { status: 400 });
    }

    await db.favoriteSetting.create({
      data: {
        userId,
        label,
        basketSize: basketSizeRaw as BasketSize,
        milkTypeId: milkTypeId || null,
        milkVolumeMl: milkTypeId ? milkVolumeMl : null,
        brewStyle: brewStyleRaw as BrewStyle,
      },
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
  const { users, milkTypes, favorites } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  const [basketSize, setBasketSize] = useState<BasketSize>(BasketSize.DOUBLE);
  const [milkTypeId, setMilkTypeId] = useState("");
  const [milkVolumeMl, setMilkVolumeMl] = useState(DEFAULT_MILK_VOLUME_ML);
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
          <label htmlFor="basketSize" className="block text-sm font-medium">
            Basket size
          </label>
          <select
            id="basketSize"
            name="basketSize"
            required
            value={basketSize}
            onChange={(event) => setBasketSize(event.target.value as BasketSize)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            {BASKET_SIZE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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

        <div>
          <label htmlFor="milkTypeId" className="block text-sm font-medium">
            Milk
          </label>
          <select
            id="milkTypeId"
            name="milkTypeId"
            value={milkTypeId}
            onChange={(event) => setMilkTypeId(event.target.value)}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          >
            <option value="">No milk</option>
            {milkTypes.map((milk) => (
              <option key={milk.id} value={milk.id}>
                {milk.name} ({formatCents(milk.pricePerLiterCents)}/L)
              </option>
            ))}
          </select>
        </div>

        {milkTypeId && (
          <div>
            <label htmlFor="milkVolumeMl" className="block text-sm font-medium">
              Milk volume (ml)
            </label>
            <input
              id="milkVolumeMl"
              name="milkVolumeMl"
              type="number"
              step="1"
              min="1"
              required
              value={milkVolumeMl}
              onChange={(event) => setMilkVolumeMl(Number(event.target.value))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        )}

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
                        {BASKET_SIZE_LABELS[favorite.basketSize]} · {BREW_STYLE_LABELS[favorite.brewStyle]}
                        {favorite.milkType ? ` · ${favorite.milkVolumeMl ?? 0}ml ${favorite.milkType.name}` : ""}
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
