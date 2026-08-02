import { data, Form, redirect } from "react-router";
import type { Route } from "./+types/beans";
import { db } from "~/lib/db.server";
import { formatCents, formatGrams, formatDateTime } from "~/lib/format";
import { getBeansWithUsage } from "~/lib/beans.server";

export async function loader() {
  const beans = await getBeansWithUsage();
  return { beans };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = String(formData.get("name") ?? "").trim();
    const roaster = String(formData.get("roaster") ?? "").trim();
    const weightGrams = Number(formData.get("weightGrams"));
    const price = Number(formData.get("price"));

    if (!name || !Number.isFinite(weightGrams) || weightGrams <= 0 || !Number.isFinite(price) || price < 0) {
      return data({ error: "Please provide a name, a positive weight, and a valid price." }, { status: 400 });
    }

    await db.bean.create({
      data: {
        name,
        roaster: roaster || null,
        weightGrams,
        priceCents: Math.round(price * 100),
      },
    });
    return redirect("/beans");
  }

  if (intent === "delete") {
    const beanId = String(formData.get("beanId") ?? "");
    try {
      await db.bean.delete({ where: { id: beanId } });
    } catch {
      return data(
        { error: "That bag has brews logged against it, so it can't be deleted." },
        { status: 400 },
      );
    }
    return redirect("/beans");
  }

  return data({ error: "Unknown action." }, { status: 400 });
}

export default function Beans({ loaderData, actionData }: Route.ComponentProps) {
  const { beans } = loaderData;
  const error = (actionData as { error?: string } | undefined)?.error;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Beans</h1>
        <p className="text-sm text-gray-500">
          Log every bag loaded into the Ninja Luxe Premier along with what it cost.
        </p>
      </div>

      <Form
        method="post"
        className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 dark:border-gray-800"
      >
        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Bean name
          </label>
          <input
            id="name"
            name="name"
            required
            placeholder="e.g. Ethiopia Yirgacheffe"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="roaster" className="block text-sm font-medium">
            Roaster (optional)
          </label>
          <input
            id="roaster"
            name="roaster"
            placeholder="e.g. Local Roastery"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="weightGrams" className="block text-sm font-medium">
            Bag weight (grams)
          </label>
          <input
            id="weightGrams"
            name="weightGrams"
            type="number"
            step="0.1"
            min="0.1"
            required
            placeholder="250"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div>
          <label htmlFor="price" className="block text-sm font-medium">
            Total price (€)
          </label>
          <input
            id="price"
            name="price"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="14.99"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </div>
        <div className="sm:col-span-2">
          <button
            type="submit"
            name="intent"
            value="create"
            className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
          >
            Add bag
          </button>
        </div>
      </Form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
        {beans.length === 0 && (
          <li className="p-4 text-sm text-gray-500">No beans logged yet.</li>
        )}
        {beans.map((bean) => (
          <li key={bean.id} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">
                {bean.name}
                {bean.roaster && <span className="font-normal text-gray-500"> · {bean.roaster}</span>}
              </p>
              <p className="text-xs text-gray-500">
                {formatGrams(bean.weightGrams)} bag · {formatCents(bean.priceCents)} ·{" "}
                {formatCents(bean.pricePerGramCents)}/g · loaded {formatDateTime(bean.createdAt)}
              </p>
              <p className="text-xs text-gray-500">
                {formatGrams(bean.usedGrams)} used ·{" "}
                <span className={bean.remainingGrams < 30 ? "font-semibold text-red-600" : ""}>
                  {formatGrams(bean.remainingGrams)} remaining
                </span>
              </p>
            </div>
            <Form method="post">
              <input type="hidden" name="beanId" value={bean.id} />
              <button
                type="submit"
                name="intent"
                value="delete"
                className="text-sm text-red-600 hover:underline"
                onClick={(event) => {
                  if (!confirm(`Delete "${bean.name}"?`)) {
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
