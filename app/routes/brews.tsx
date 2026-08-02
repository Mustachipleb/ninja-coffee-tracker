import { useMemo, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/brews";
import { db } from "~/lib/db.server";
import { getBeansWithUsage } from "~/lib/beans.server";
import { brewCostCents } from "~/lib/cost";
import { formatCents, formatDateTime, formatGrams } from "~/lib/format";
import { BREW_STYLE_OPTIONS, BREW_STYLE_LABELS, BrewStyle, isBrewStyle } from "~/lib/brew-style";

export async function loader() {
  const [users, beans, favorites, brews] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getBeansWithUsage(),
    db.favoriteSetting.findMany({
      include: { user: true },
      orderBy: [{ user: { name: "asc" } }, { label: "asc" }],
    }),
    db.brew.findMany({
      orderBy: { brewedAt: "desc" },
      take: 50,
      include: { user: true, bean: true },
    }),
  ]);

  return { users, beans, favorites, brews };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const userId = String(formData.get("userId") ?? "");
    const beanId = String(formData.get("beanId") ?? "");
    const grindAmountGrams = Number(formData.get("grindAmountGrams"));
    const milkFrothed = formData.get("milkFrothed") === "on";
    const brewStyleRaw = String(formData.get("brewStyle") ?? "");
    const label = String(formData.get("label") ?? "").trim();

    if (!userId || !beanId) {
      return data({ error: "Please choose who is brewing and which beans." }, { status: 400 });
    }
    if (!Number.isFinite(grindAmountGrams) || grindAmountGrams <= 0) {
      return data({ error: "Grind amount must be a positive number of grams." }, { status: 400 });
    }
    if (!isBrewStyle(brewStyleRaw)) {
      return data({ error: "Please choose a valid brew style." }, { status: 400 });
    }

    await db.brew.create({
      data: {
        userId,
        beanId,
        grindAmountGrams,
        milkFrothed,
        brewStyle: brewStyleRaw as BrewStyle,
        label: label || null,
      },
    });
    return redirect("/brews");
  }

  if (intent === "delete") {
    const brewId = String(formData.get("brewId") ?? "");
    await db.brew.delete({ where: { id: brewId } });
    return redirect("/brews");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Brews({ loaderData, actionData }: Route.ComponentProps) {
  const { users, beans, favorites, brews } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [grindAmountGrams, setGrindAmountGrams] = useState(18);
  const [milkFrothed, setMilkFrothed] = useState(false);
  const [brewStyle, setBrewStyle] = useState<BrewStyle>(BrewStyle.CLASSIC);
  const [favoriteId, setFavoriteId] = useState("");

  const favoritesForUser = useMemo(
    () => favorites.filter((favorite) => favorite.userId === userId),
    [favorites, userId],
  );

  function applyFavorite(id: string) {
    setFavoriteId(id);
    const favorite = favorites.find((f) => f.id === id);
    if (!favorite) return;
    setGrindAmountGrams(favorite.grindAmountGrams);
    setMilkFrothed(favorite.milkFrothed);
    setBrewStyle(favorite.brewStyle);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Brews</h1>
        <p className="text-sm text-gray-500">Log a cup as soon as it comes out of the machine.</p>
      </div>

      <Form method="post" className="space-y-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="userId" className="block text-sm font-medium">
              Who's brewing?
            </label>
            <select
              id="userId"
              name="userId"
              required
              value={userId}
              onChange={(event) => {
                setUserId(event.target.value);
                setFavoriteId("");
              }}
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
            <label htmlFor="favoriteId" className="block text-sm font-medium">
              Quick-fill from favorite
            </label>
            <select
              id="favoriteId"
              value={favoriteId}
              onChange={(event) => applyFavorite(event.target.value)}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">— none —</option>
              {favoritesForUser.map((favorite) => (
                <option key={favorite.id} value={favorite.id}>
                  {favorite.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="beanId" className="block text-sm font-medium">
              Beans
            </label>
            <select
              id="beanId"
              name="beanId"
              required
              defaultValue={beans[0]?.id ?? ""}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              {beans.length === 0 && <option value="">Add a bag first</option>}
              {beans.map((bean) => (
                <option key={bean.id} value={bean.id}>
                  {bean.name} ({formatGrams(bean.remainingGrams)} left, {formatCents(bean.pricePerGramCents)}/g)
                </option>
              ))}
            </select>
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
            <label htmlFor="label" className="block text-sm font-medium">
              Note (optional)
            </label>
            <input
              id="label"
              name="label"
              placeholder="e.g. Sunday morning pick-me-up"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <button
          type="submit"
          name="intent"
          value="create"
          disabled={isSubmitting || users.length === 0 || beans.length === 0}
          className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
        >
          {isSubmitting ? "Logging..." : "Log brew"}
        </button>
      </Form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Recent brews</h2>
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {brews.length === 0 && (
            <li className="p-4 text-sm text-gray-500">No brews logged yet.</li>
          )}
          {brews.map((brew) => (
            <li key={brew.id} className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="font-medium">
                  {brew.user.name} · {formatGrams(brew.grindAmountGrams)} of {brew.bean.name}
                </p>
                <p className="text-xs text-gray-500">
                  {BREW_STYLE_LABELS[brew.brewStyle]}
                  {brew.milkFrothed ? " · with frothed milk" : ""} ·{" "}
                  {formatCents(brewCostCents(brew, brew.bean))} · {formatDateTime(brew.brewedAt)}
                  {brew.label ? ` · "${brew.label}"` : ""}
                </p>
              </div>
              <Form method="post">
                <input type="hidden" name="brewId" value={brew.id} />
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
    </div>
  );
}
