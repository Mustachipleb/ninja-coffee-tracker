import { Link } from "react-router";
import type { Route } from "./+types/home";
import { db } from "~/lib/db.server";
import { getBeansWithUsage } from "~/lib/beans.server";
import { getUserReconciliations } from "~/lib/reconciliation.server";
import { brewCostCents } from "~/lib/cost";
import { formatCents, formatDateTime, formatGrams } from "~/lib/format";
import { BASKET_SIZE_LABELS } from "~/lib/basket-size";
import { requireAuth } from "~/lib/session.server";

export function meta(_args: Route.MetaArgs) {
  return [
    { title: "Ninja Coffee Tracker" },
    { name: "description", content: "Track coffee brewing and costs for the Ninja Luxe Premier." },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);

  const [reconciliations, beans, recentBrews, userCount, beanCount] = await Promise.all([
    getUserReconciliations(),
    getBeansWithUsage(),
    db.brew.findMany({
      orderBy: { brewedAt: "desc" },
      take: 5,
      include: { user: true, bean: true, milkType: true },
    }),
    db.user.count(),
    db.bean.count(),
  ]);

  const grandTotalBrewedCents = reconciliations.reduce((sum, u) => sum + u.totalBrewedCents, 0);
  const grandOutstandingCents = reconciliations.reduce((sum, u) => sum + Math.max(0, u.outstandingCents), 0);
  const totalBrews = reconciliations.reduce((sum, u) => sum + u.brewCount, 0);
  const lowBeans = beans.filter((bean) => bean.remainingGrams < 30 && bean.remainingGrams > 0);
  const emptyBeans = beans.filter((bean) => bean.remainingGrams <= 0);

  return {
    reconciliations,
    recentBrews,
    userCount,
    beanCount,
    grandTotalBrewedCents,
    grandOutstandingCents,
    totalBrews,
    lowBeans,
    emptyBeans,
  };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const {
    reconciliations,
    recentBrews,
    userCount,
    beanCount,
    grandTotalBrewedCents,
    grandOutstandingCents,
    totalBrews,
    lowBeans,
    emptyBeans,
  } = loaderData;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-500">Ninja Luxe Premier coffee tracking for the group.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">People</p>
          <p className="text-2xl font-bold">{userCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Bags of beans</p>
          <p className="text-2xl font-bold">{beanCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Brews logged</p>
          <p className="text-2xl font-bold">{totalBrews}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-4 dark:border-gray-800">
          <p className="text-xs uppercase text-gray-500">Total brewed</p>
          <p className="text-2xl font-bold">{formatCents(grandTotalBrewedCents)}</p>
        </div>
      </div>

      {grandOutstandingCents > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950">
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {formatCents(grandOutstandingCents)} outstanding across the group
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Record payments or scan a QR code to settle up
            </p>
          </div>
          <Link
            to="/payments"
            className="shrink-0 rounded-md bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            💳 Pay
          </Link>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Link to="/brew-wizard" className="rounded-md bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800">
          📱 Log a brew
        </Link>
        <Link to="/payments" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          💳 Payments
        </Link>
        <Link to="/beans" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          Add beans
        </Link>
        <Link to="/costs" className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
          View costs
        </Link>
      </div>

      {(lowBeans.length > 0 || emptyBeans.length > 0) && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950">
          {emptyBeans.length > 0 && (
            <p>🚨 Out of beans: {emptyBeans.map((b) => b.name).join(", ")}</p>
          )}
          {lowBeans.length > 0 && (
            <p>⚠️ Running low: {lowBeans.map((b) => `${b.name} (${formatGrams(b.remainingGrams)})`).join(", ")}</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-lg font-semibold">Who owes what</h2>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {reconciliations.length === 0 && <li className="p-4 text-sm text-gray-500">No brews yet.</li>}
            {reconciliations
              .slice()
              .sort((a, b) => b.outstandingCents - a.outstandingCents)
              .map((user) => (
                <li key={user.id} className="flex items-center justify-between p-3 text-sm">
                  <span className="font-medium">{user.name}</span>
                  <span
                    className={
                      user.outstandingCents > 0
                        ? "text-red-600 dark:text-red-400"
                        : user.outstandingCents < 0
                        ? "text-green-700 dark:text-green-400"
                        : "text-gray-400"
                    }
                  >
                    {user.outstandingCents > 0
                      ? `Owes ${formatCents(user.outstandingCents)}`
                      : user.outstandingCents < 0
                      ? `Credit ${formatCents(-user.outstandingCents)}`
                      : "Settled ✓"}
                  </span>
                </li>
              ))}
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent brews</h2>
          <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {recentBrews.length === 0 && <li className="p-4 text-sm text-gray-500">No brews yet.</li>}
            {recentBrews.map((brew) => (
              <li key={brew.id} className="p-3 text-sm">
                <p className="font-medium">
                  {brew.user.name} · {formatCents(brewCostCents(brew, brew.bean, brew.milkType))}
                </p>
                <p className="text-xs text-gray-500">
                  {BASKET_SIZE_LABELS[brew.basketSize]} {brew.bean.name} · {formatDateTime(brew.brewedAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
