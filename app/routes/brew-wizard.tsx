import { useMemo, useState } from "react";
import { data, Form, redirect, useNavigate, useNavigation } from "react-router";
import type { Route } from "./+types/brew-wizard";
import { db } from "~/lib/db.server";
import { getBeansWithUsage } from "~/lib/beans.server";
import { beanCostCents, brewCostCents, milkCostCents } from "~/lib/cost";
import { formatCents } from "~/lib/format";
import { BREW_STYLE_OPTIONS, BREW_STYLE_LABELS, BrewStyle, isBrewStyle } from "~/lib/brew-style";
import { BASKET_SIZE_OPTIONS, BASKET_SIZE_LABELS, BASKET_GRAMS, BasketSize, isBasketSize } from "~/lib/basket-size";

const DEFAULT_MILK_VOLUME_ML = 100;
const MILK_VOLUME_STEPS = [50, 100, 150, 200, 250, 300];

export async function loader() {
  const [users, beans, milkTypes, favorites] = await Promise.all([
    db.user.findMany({ orderBy: { name: "asc" } }),
    getBeansWithUsage(),
    db.milkType.findMany({ orderBy: { name: "asc" } }),
    db.favoriteSetting.findMany({
      include: { user: true, milkType: true },
      orderBy: [{ user: { name: "asc" } }, { label: "asc" }],
    }),
  ]);

  return { users, beans, milkTypes, favorites };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const userId = String(formData.get("userId") ?? "");
    const beanId = String(formData.get("beanId") ?? "");
    const basketSizeRaw = String(formData.get("basketSize") ?? "");
    const milkTypeId = String(formData.get("milkTypeId") ?? "").trim();
    const milkVolumeMl = Number(formData.get("milkVolumeMl"));
    const brewStyleRaw = String(formData.get("brewStyle") ?? "");
    const label = String(formData.get("label") ?? "").trim();

    if (!userId || !beanId) {
      return data({ error: "Please choose who is brewing and which beans." }, { status: 400 });
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

    await db.brew.create({
      data: {
        userId,
        beanId,
        basketSize: basketSizeRaw as BasketSize,
        milkTypeId: milkTypeId || null,
        milkVolumeMl: milkTypeId ? milkVolumeMl : null,
        brewStyle: brewStyleRaw as BrewStyle,
        label: label || null,
      },
    });
    return redirect("/brews?logged=1");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

type Step = "user" | "favorite" | "beans" | "basket" | "milk" | "style" | "review";

const STEP_ORDER: Step[] = ["user", "favorite", "beans", "basket", "milk", "style", "review"];
const STEP_TITLES: Record<Step, string> = {
  user: "Who's brewing?",
  favorite: "Use a favorite?",
  beans: "Which beans?",
  basket: "Basket size",
  milk: "Add milk?",
  style: "Brew style",
  review: "Review & log",
};

export default function BrewWizard({ loaderData, actionData }: Route.ComponentProps) {
  const { users, beans, milkTypes, favorites } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;
  const navigation = useNavigation();
  const navigate = useNavigate();
  const isSubmitting = navigation.state === "submitting";

  const [stepIndex, setStepIndex] = useState(0);
  const [userId, setUserId] = useState("");
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [beanId, setBeanId] = useState("");
  const [basketSize, setBasketSize] = useState<BasketSize>(BasketSize.DOUBLE);
  const [milkTypeId, setMilkTypeId] = useState("");
  const [milkVolumeMl, setMilkVolumeMl] = useState(DEFAULT_MILK_VOLUME_ML);
  const [brewStyle, setBrewStyle] = useState<BrewStyle>(BrewStyle.CLASSIC);
  const [label, setLabel] = useState("");

  const step = STEP_ORDER[stepIndex];

  const favoritesForUser = useMemo(
    () => favorites.filter((favorite) => favorite.userId === userId),
    [favorites, userId],
  );
  const selectedBean = useMemo(() => beans.find((bean) => bean.id === beanId), [beans, beanId]);
  const selectedMilk = useMemo(() => milkTypes.find((milk) => milk.id === milkTypeId), [milkTypes, milkTypeId]);
  const selectedUser = useMemo(() => users.find((user) => user.id === userId), [users, userId]);

  const estimatedCostCents = selectedBean
    ? brewCostCents(
        { basketSize, milkVolumeMl: milkTypeId ? milkVolumeMl : null },
        selectedBean,
        selectedMilk ?? null,
      )
    : 0;

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  function applyFavorite(id: string) {
    setFavoriteId(id);
    const favorite = favorites.find((f) => f.id === id);
    if (favorite) {
      setBasketSize(favorite.basketSize);
      setMilkTypeId(favorite.milkTypeId ?? "");
      setMilkVolumeMl(favorite.milkVolumeMl ?? DEFAULT_MILK_VOLUME_ML);
      setBrewStyle(favorite.brewStyle);
      // Jump straight to bean selection since the rest is pre-filled.
      setStepIndex(STEP_ORDER.indexOf("beans"));
      return;
    }
    goNext();
  }

  function skipFavorite() {
    setFavoriteId(null);
    goNext();
  }

  const canProceed: Record<Step, boolean> = {
    user: !!userId,
    favorite: true,
    beans: !!beanId,
    basket: !!basketSize,
    milk: !milkTypeId || milkVolumeMl > 0,
    style: !!brewStyle,
    review: true,
  };

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 pb-24">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h1 className="text-xl font-bold">{STEP_TITLES[step]}</h1>
          <span className="text-xs text-gray-500">
            Step {stepIndex + 1} of {STEP_ORDER.length}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-amber-700 transition-all"
            style={{ width: `${((stepIndex + 1) / STEP_ORDER.length) * 100}%` }}
          />
        </div>
      </div>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-950">{error}</p>}

      {step === "user" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {users.length === 0 && (
            <p className="text-sm text-gray-500">
              No people yet — <a href="/users" className="underline">add someone</a> first.
            </p>
          )}
          {users.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => {
                setUserId(user.id);
                setFavoriteId(null);
                goNext();
              }}
              className={`min-h-14 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors ${
                userId === user.id
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              {user.name}
            </button>
          ))}
        </div>
      )}

      {step === "favorite" && (
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={skipFavorite}
            className={`min-h-14 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors ${
              favoriteId === null
                ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            }`}
          >
            Start from scratch
          </button>
          {favoritesForUser.length === 0 && (
            <p className="text-sm text-gray-500">{selectedUser?.name ?? "This person"} has no saved favorites yet.</p>
          )}
          {favoritesForUser.map((favorite) => (
            <button
              key={favorite.id}
              type="button"
              onClick={() => applyFavorite(favorite.id)}
              className={`min-h-14 rounded-lg border px-4 py-3 text-left transition-colors ${
                favoriteId === favorite.id
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              <p className="text-base font-medium">{favorite.label}</p>
              <p className="text-xs text-gray-500">
                {BASKET_SIZE_LABELS[favorite.basketSize]} · {BREW_STYLE_LABELS[favorite.brewStyle]}
                {favorite.milkType ? ` · ${favorite.milkVolumeMl ?? 0}ml ${favorite.milkType.name}` : ""}
              </p>
            </button>
          ))}
        </div>
      )}

      {step === "beans" && (
        <div className="flex flex-col gap-3">
          {beans.length === 0 && (
            <p className="text-sm text-gray-500">
              No beans registered — <a href="/beans" className="underline">add a bag</a> first.
            </p>
          )}
          {beans.map((bean) => (
            <button
              key={bean.id}
              type="button"
              onClick={() => {
                setBeanId(bean.id);
                goNext();
              }}
              className={`min-h-14 rounded-lg border px-4 py-3 text-left transition-colors ${
                beanId === bean.id
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              <p className="text-base font-medium">{bean.name}</p>
              <p className="text-xs text-gray-500">
                {bean.remainingGrams.toFixed(1)}g left · {formatCents(bean.pricePerGramCents)}/g
              </p>
            </button>
          ))}
        </div>
      )}

      {step === "basket" && (
        <div className="grid grid-cols-1 gap-3">
          {BASKET_SIZE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setBasketSize(option.value);
                goNext();
              }}
              className={`min-h-16 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors ${
                basketSize === option.value
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              {option.label}
              {selectedBean && (
                <span className="ml-2 text-xs text-gray-500">
                  ({formatCents(beanCostCents(option.value, selectedBean))})
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {step === "milk" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setMilkTypeId("");
                goNext();
              }}
              className={`min-h-14 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors ${
                milkTypeId === ""
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              No milk
            </button>
            {milkTypes.map((milk) => (
              <button
                key={milk.id}
                type="button"
                onClick={() => setMilkTypeId(milk.id)}
                className={`min-h-14 rounded-lg border px-4 py-3 text-left transition-colors ${
                  milkTypeId === milk.id
                    ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                    : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                }`}
              >
                <p className="text-base font-medium">{milk.name}</p>
                <p className="text-xs text-gray-500">{formatCents(milk.pricePerLiterCents)}/L</p>
              </button>
            ))}
          </div>

          {milkTypeId && (
            <div>
              <p className="mb-2 text-sm font-medium">Milk volume: {milkVolumeMl}ml</p>
              <div className="flex flex-wrap gap-2">
                {MILK_VOLUME_STEPS.map((ml) => (
                  <button
                    key={ml}
                    type="button"
                    onClick={() => setMilkVolumeMl(ml)}
                    className={`min-h-11 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
                      milkVolumeMl === ml
                        ? "border-amber-700 bg-amber-700 text-white"
                        : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
                    }`}
                  >
                    {ml}ml
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={goNext}
                className="mt-4 min-h-12 w-full rounded-lg bg-amber-700 px-4 py-3 text-base font-medium text-white hover:bg-amber-800"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {step === "style" && (
        <div className="grid grid-cols-1 gap-3">
          {BREW_STYLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setBrewStyle(option.value);
                goNext();
              }}
              className={`min-h-14 rounded-lg border px-4 py-3 text-left text-base font-medium transition-colors ${
                brewStyle === option.value
                  ? "border-amber-700 bg-amber-50 dark:bg-amber-950"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {step === "review" && (
        <Form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="beanId" value={beanId} />
          <input type="hidden" name="basketSize" value={basketSize} />
          <input type="hidden" name="milkTypeId" value={milkTypeId} />
          <input type="hidden" name="milkVolumeMl" value={milkTypeId ? milkVolumeMl : ""} />
          <input type="hidden" name="brewStyle" value={brewStyle} />

          <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Who</dt>
                <dd className="font-medium">{selectedUser?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Beans</dt>
                <dd className="font-medium">{selectedBean?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Basket</dt>
                <dd className="font-medium">
                  {BASKET_SIZE_LABELS[basketSize]} ({BASKET_GRAMS[basketSize]}g)
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Milk</dt>
                <dd className="font-medium">
                  {selectedMilk ? `${milkVolumeMl}ml ${selectedMilk.name}` : "None"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Style</dt>
                <dd className="font-medium">{BREW_STYLE_LABELS[brewStyle]}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 dark:border-gray-800">
                <dt className="font-medium">Estimated cost</dt>
                <dd className="font-bold text-amber-700 dark:text-amber-500">{formatCents(estimatedCostCents)}</dd>
              </div>
              {selectedMilk && milkTypeId && (
                <div className="flex justify-between text-xs text-gray-500">
                  <dt>— of which milk</dt>
                  <dd>{formatCents(milkCostCents(milkVolumeMl, selectedMilk))}</dd>
                </div>
              )}
            </dl>
          </div>

          <div>
            <label htmlFor="label" className="block text-sm font-medium">
              Note (optional)
            </label>
            <input
              id="label"
              name="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="e.g. Sunday morning pick-me-up"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>

          <button
            type="submit"
            name="intent"
            value="create"
            disabled={isSubmitting}
            className="min-h-14 w-full rounded-lg bg-amber-700 px-4 py-3 text-base font-semibold text-white hover:bg-amber-800 disabled:opacity-50"
          >
            {isSubmitting ? "Logging..." : "☕ Log this brew"}
          </button>
        </Form>
      )}

      {step !== "review" && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (stepIndex === 0 ? navigate("/brews") : goBack())}
              className="min-h-12 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              {stepIndex === 0 ? "Cancel" : "Back"}
            </button>
            {step !== "milk" && (
              <button
                type="button"
                onClick={goNext}
                disabled={!canProceed[step]}
                className="min-h-12 flex-1 rounded-lg bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800 disabled:opacity-40"
              >
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {step === "review" && stepIndex > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95">
          <div className="mx-auto max-w-lg">
            <button
              type="button"
              onClick={goBack}
              className="min-h-12 w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
            >
              Back
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
