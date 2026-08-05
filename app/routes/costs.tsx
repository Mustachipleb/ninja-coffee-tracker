import { Link } from "react-router";
import { db } from "~/lib/db.server";
import type { Route } from "./+types/costs";
import { getUserReconciliations } from "~/lib/reconciliation.server";
import { beanCostCents, milkCostCents } from "~/lib/cost";
import { formatCents, formatGrams } from "~/lib/format";
import { gramsForBasket } from "~/lib/basket-size";
import { requireAuth } from "~/lib/session.server";
import { getCurrentUserWithRole, canSeeAllBalances } from "~/lib/authorize.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const currentUser = await getCurrentUserWithRole(request);
  const showAll = canSeeAllBalances(currentUser!);

  const [reconciliations, beans, milkTypes] = await Promise.all([
    getUserReconciliations(),
    db.bean.findMany({
      orderBy: { createdAt: "desc" },
      include: { brews: { include: { user: true } } },
    }),
    db.milkType.findMany({
      orderBy: { createdAt: "desc" },
      include: { brews: { include: { user: true } } },
    }),
  ]);

  // Filter reconciliations for non-admin users
  const filteredReconciliations = showAll
    ? reconciliations
    : reconciliations.filter((r) => r.id === currentUser!.id);

  const beanBreakdowns = beans.map((bean) => {
    const perUser = new Map<string, { name: string; grams: number; cents: number }>();
    for (const brew of bean.brews) {
      const entry = perUser.get(brew.userId) ?? { name: brew.user.name, grams: 0, cents: 0 };
      entry.grams += gramsForBasket(brew.basketSize);
      entry.cents += beanCostCents(brew.basketSize, bean);
      perUser.set(brew.userId, entry);
    }
    return {
      id: bean.id,
      name: bean.name,
      totalCents: [...perUser.values()].reduce((sum, e) => sum + e.cents, 0),
      perUser: [...perUser.values()].sort((a, b) => b.cents - a.cents),
    };
  }).filter((bean) => showAll || bean.perUser.some((p) => p.name === currentUser!.name));

  const milkBreakdowns = milkTypes.map((milk) => {
    const perUser = new Map<string, { name: string; volumeMl: number; cents: number }>();
    for (const brew of milk.brews) {
      if (!brew.milkVolumeMl) continue;
      const entry = perUser.get(brew.userId) ?? { name: brew.user.name, volumeMl: 0, cents: 0 };
      entry.volumeMl += brew.milkVolumeMl;
      entry.cents += milkCostCents(brew.milkVolumeMl, milk);
      perUser.set(brew.userId, entry);
    }
    return {
      id: milk.id,
      name: milk.name,
      totalCents: [...perUser.values()].reduce((sum, e) => sum + e.cents, 0),
      perUser: [...perUser.values()].sort((a, b) => b.cents - a.cents),
    };
  }).filter((milk) => showAll || milk.perUser.some((p) => p.name === currentUser!.name));

  const grandBrewedCents = filteredReconciliations.reduce((sum, u) => sum + u.totalBrewedCents, 0);
  const grandPaidCents = filteredReconciliations.reduce((sum, u) => sum + u.totalPaidCents, 0);
  const grandOutstandingCents = filteredReconciliations.reduce((sum, u) => sum + Math.max(0, u.outstandingCents), 0);
  const totalBrews = filteredReconciliations.reduce((sum, u) => sum + u.brewCount, 0);

  return {
    reconciliations: filteredReconciliations,
    beanBreakdowns,
    milkBreakdowns,
    grandBrewedCents,
    grandPaidCents,
    grandOutstandingCents,
    totalBrews,
  };
}

export default function Costs({ loaderData }: Route.ComponentProps) {
  const {
    reconciliations,
    beanBreakdowns,
    milkBreakdowns,
    grandBrewedCents,
    grandPaidCents,
    grandOutstandingCents,
    totalBrews,
  } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-2xl font-bold">Costs</h1>
        <p className="text-sm text-gray-500">
          What everyone owes, based on how much bean and milk each brew used. Payments are deducted.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total brewed</p>
          <p className="text-2xl font-bold">{formatCents(grandBrewedCents)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total paid</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCents(grandPaidCents)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Outstanding</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-500">{formatCents(grandOutstandingCents)}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total brews</p>
          <p className="text-2xl font-bold">{totalBrews}</p>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Per person</h2>
          <Link
            to="/payments"
            className="rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            💳 Record payment / QR code
          </Link>
        </div>
        <table className="w-full overflow-hidden rounded-lg border border-gray-200 text-sm dark:border-gray-800">
          <thead className="bg-gray-50 text-left dark:bg-gray-900">
            <tr>
              <th className="p-3">Person</th>
              <th className="p-3">Brews</th>
              <th className="p-3">Brewed</th>
              <th className="p-3">Paid</th>
              <th className="p-3">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {reconciliations.length === 0 && (
              <tr>
                <td className="p-3 text-gray-500" colSpan={5}>
                  No one has logged a brew yet.
                </td>
              </tr>
            )}
            {reconciliations.map((user) => (
              <tr key={user.id}>
                <td className="p-3 font-medium">{user.name}</td>
                <td className="p-3">{user.brewCount}</td>
                <td className="p-3">{formatCents(user.totalBrewedCents)}</td>
                <td className="p-3 text-green-700 dark:text-green-400">{formatCents(user.totalPaidCents)}</td>
                <td className={`p-3 font-medium ${
                  user.outstandingCents > 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"
                }`}>
                  {user.outstandingCents > 0
                    ? formatCents(user.outstandingCents)
                    : user.outstandingCents < 0
                    ? `Credit ${formatCents(-user.outstandingCents)}`
                    : "Settled ✓"}
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
                    <span>{entry.name} · {formatGrams(entry.grams)}</span>
                    <span>{formatCents(entry.cents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Per milk</h2>
        <p className="mb-2 text-xs text-gray-500">
          Handy for settling up with whoever bought the milk.
        </p>
        <div className="space-y-4">
          {milkBreakdowns.length === 0 && (
            <p className="text-sm text-gray-500">No milk has been used yet.</p>
          )}
          {milkBreakdowns.map((milk) => (
            <div key={milk.id} className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium">{milk.name}</p>
                <p className="text-sm text-gray-500">{formatCents(milk.totalCents)} total</p>
              </div>
              <ul className="space-y-1 text-sm">
                {milk.perUser.map((entry) => (
                  <li key={entry.name} className="flex justify-between text-gray-600 dark:text-gray-300">
                    <span>{entry.name} · {entry.volumeMl}ml</span>
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
