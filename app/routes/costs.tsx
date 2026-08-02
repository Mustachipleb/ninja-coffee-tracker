import { db } from "~/lib/db.server";
import type { Route } from "./+types/costs";
import { getUserCostSummaries } from "~/lib/cost-summary.server";
import { brewCostCents } from "~/lib/cost";
import { formatCents, formatGrams } from "~/lib/format";

export async function loader(_args: Route.LoaderArgs) {
  const [userSummaries, beans] = await Promise.all([
    getUserCostSummaries(),
    db.bean.findMany({
      orderBy: { createdAt: "desc" },
      include: { brews: { include: { user: true } } },
    }),
  ]);

  const beanBreakdowns = beans.map((bean) => {
    const perUser = new Map<string, { name: string; grams: number; cents: number }>();
    for (const brew of bean.brews) {
      const entry = perUser.get(brew.userId) ?? { name: brew.user.name, grams: 0, cents: 0 };
      entry.grams += brew.grindAmountGrams;
      entry.cents += brewCostCents(brew, bean);
      perUser.set(brew.userId, entry);
    }
    return {
      id: bean.id,
      name: bean.name,
      totalCents: [...perUser.values()].reduce((sum, e) => sum + e.cents, 0),
      perUser: [...perUser.values()].sort((a, b) => b.cents - a.cents),
    };
  }).filter((bean) => bean.perUser.length > 0);

  const grandTotalCents = userSummaries.reduce((sum, u) => sum + u.totalCents, 0);
  const totalBrews = userSummaries.reduce((sum, u) => sum + u.brewCount, 0);

  return { userSummaries, beanBreakdowns, grandTotalCents, totalBrews };
}

export default function Costs({ loaderData }: Route.ComponentProps) {
  const { userSummaries, beanBreakdowns, grandTotalCents, totalBrews } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Costs</h1>
        <p className="text-sm text-gray-500">
          What everyone owes, based on how much bean (by weight and price) each brew used.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total spent</p>
          <p className="text-2xl font-bold">{formatCents(grandTotalCents)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total brews</p>
          <p className="text-2xl font-bold">{totalBrews}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">People</p>
          <p className="text-2xl font-bold">{userSummaries.length}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Per person</h2>
        <table className="w-full overflow-hidden rounded-lg border border-gray-200 text-sm dark:border-gray-800">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Brews</th>
              <th className="p-3">Total</th>
              <th className="p-3">Avg / brew</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {userSummaries.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={4}>
                  No one has logged a brew yet.
                </td>
              </tr>
            )}
            {userSummaries.map((user) => (
              <tr key={user.id}>
                <td className="p-3 font-medium">{user.name}</td>
                <td className="p-3">{user.brewCount}</td>
                <td className="p-3">{formatCents(user.totalCents)}</td>
                <td className="p-3">
                  {user.brewCount > 0 ? formatCents(user.totalCents / user.brewCount) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Per bag of beans</h2>
        <p className="mb-2 text-xs text-gray-500">
          Handy for settling up with whoever bought the bag.
        </p>
        <div className="space-y-4">
          {beanBreakdowns.length === 0 && (
            <p className="text-sm text-gray-500">No beans have been brewed with yet.</p>
          )}
          {beanBreakdowns.map((bean) => (
            <div key={bean.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{bean.name}</p>
                <p className="text-sm text-gray-500">{formatCents(bean.totalCents)} total</p>
              </div>
              <ul className="space-y-1 text-sm">
                {bean.perUser.map((entry) => (
                  <li key={entry.name} className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>
                      {entry.name} · {formatGrams(entry.grams)}
                    </span>
                    <span>{formatCents(entry.cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
