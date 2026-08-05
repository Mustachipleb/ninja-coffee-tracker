import { useMemo, useState } from "react";
import { data, Form, redirect, useNavigation } from "react-router";
import type { Route } from "./+types/brews";
import { db } from "~/lib/db.server";
import { getBeansWithUsage } from "~/lib/beans.server";
import { brewCostCents } from "~/lib/cost";
import { formatCents, formatDateTime } from "~/lib/format";
import { BASKET_SIZE_OPTIONS, BASKET_SIZE_LABELS, BasketSize, isBasketSize } from "~/lib/basket-size";
import { requireAuth } from "~/lib/session.server";
import { getCurrentUserWithRole, canDeleteBrew } from "~/lib/authorize.server";

const DEFAULT_MILK_VOLUME_ML = 100;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const [users, beans, milkTypes, favorites, brews] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getBeansWithUsage(),
    db.milkType.findMany({ orderBy: { name: "asc" } }),
    db.favoriteSetting.findMany({
      include: { user: true },
      orderBy: [{ user: { name: "asc" } }, { label: "asc" }],
    }),
    db.brew.findMany({
      orderBy: { brewedAt: "desc" },
      take: 50,
      include: { user: true, bean: true, milkType: true },
    }),
  ]);

  return { users, beans, milkTypes, favorites, brews };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    await requireAuth(request);
    const userId = String(formData.get("userId") ?? "");
    const beanId = String(formData.get("beanId") ?? "");
    const basketSizeRaw = String(formData.get("basketSize") ?? "");
    const milkTypeId = String(formData.get("milkTypeId") ?? "").trim();
    const milkVolumeMl = Number(formData.get("milkVolumeMl"));
    const label = String(formData.get("label") ?? "").trim();

    if (!userId || !beanId) {
      return data({ error: "Please choose who is brewing and which beans." }, { status: 400 });
    }
    if (!isBasketSize(basketSizeRaw)) {
      return data({ error: "Please choose a valid basket size." }, { status: 400 });
    }
    if (milkTypeId && (!Number.isFinite(milkVolumeMl) || milkVolumeMl <= 0)) {
      return data({ error: "Please provide a positive milk volume (ml)." }, { status: 400 });
    }

    await db.brew.create({
      data: {
        userId,
        beanId,
        basketSize: basketSizeRaw as BasketSize,
        milkTypeId: milkTypeId || null,
        milkVolumeMl: milkTypeId ? milkVolumeMl : null,
        label: label || null,
      },
    });
    return redirect("/brews");
  }

  if (intent === "delete") {
    const user = await getCurrentUserWithRole(request);
    if (!user) throw redirect("/login");

    const brewId = String(formData.get("brewId") ?? "");
    const canDelete = await canDeleteBrew(user, brewId);
    if (!canDelete) {
      return data({ error: "You can only delete your own brews." }, { status: 403 });
    }

    await db.brew.delete({ where: { id: brewId } });
    return redirect("/brews");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Brews({ loaderData, actionData }: Route.ComponentProps) {
  const { users, beans, milkTypes, favorites, brews } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [userId, setUserId] = useState(users[0]?.id ?? "");
  const [basketSize, setBasketSize] = useState<BasketSize>(BasketSize.DOUBLE);
  const [milkTypeId, setMilkTypeId] = useState("");
  const [milkVolumeMl, setMilkVolumeMl] = useState(DEFAULT_MILK_VOLUME_ML);
  const [favoriteId, setFavoriteId] = useState("");

  const favoritesForUser = useMemo(
    () => favorites.filter((favorite) => favorite.userId === userId),
    [favorites, userId],
  );

  function applyFavorite(id: string) {
    setFavoriteId(id);
    const favorite = favorites.find((f) => f.id === id);
    if (!favorite) return;
    setBasketSize(favorite.basketSize);
    setMilkTypeId(favorite.milkTypeId ?? "");
    setMilkVolumeMl(favorite.milkVolumeMl ?? DEFAULT_MILK_VOLUME_ML);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Brews</h1>
          <p className="text-sm text-gray-500">Log a cup as soon as it comes out of the machine.</p>
        </div>
        <a
          href="/brew-wizard"
          className="shrink-0 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 sm:hidden"
        >
          📱 Use wizard
        </a>
      </div>
      <a
        href="/brew-wizard"
        className="hidden rounded-lg border border-dashed border-amber-700 p-3 text-center text-sm font-medium text-amber-700 hover:bg-amber-50 sm:block dark:text-amber-500 dark:hover:bg-amber-950"
      >
        📱 Prefer a step-by-step flow? Try the mobile-friendly brew wizard →
      </a>

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
                  {bean.name} ({bean.remainingGrams.toFixed(1)}g left, {formatCents(bean.pricePerGramCents)}/g)
                </option>
              ))}
            </select>
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
                  {brew.user.name} · {BASKET_SIZE_LABELS[brew.basketSize]} of {brew.bean.name}
                </p>
                <p className="text-xs text-gray-500">
                  {brew.milkType ? ` · ${brew.milkVolumeMl ?? 0}ml ${brew.milkType.name}` : ""} ·{" "}
                  {formatCents(brewCostCents(brew, brew.bean, brew.milkType))} · {formatDateTime(brew.brewedAt)}
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
