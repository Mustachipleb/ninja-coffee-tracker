import { NavLink, Outlet, Form } from "react-router";
import type { Route } from "./+types/layout";
import { getCurrentUser } from "~/lib/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  return { user };
}

const NAV_LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/brew-wizard", label: "📱 Wizard" },
  { to: "/brews", label: "Brews" },
  { to: "/beans", label: "Beans" },
  { to: "/milks", label: "Milks" },
  { to: "/favorites", label: "Favorites" },
  { to: "/users", label: "People" },
  { to: "/costs", label: "Costs" },
  { to: "/payments", label: "Payments" },
  { to: "/settings", label: "⚙ Settings" },
  { to: "/account", label: "🔑 Account" },
];

export default function AppLayout({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
            <span className="text-lg font-bold tracking-tight text-amber-700 dark:text-amber-500">
              ☕ Ninja Coffee Tracker
            </span>
            <div className="flex items-center gap-3">
              {user && (
                <>
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Signed in as <span className="font-medium">{user.name}</span>
                  </span>
                  <Form action="/logout" method="post">
                    <button
                      type="submit"
                      className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                    >
                      Sign out
                    </button>
                  </Form>
                </>
              )}
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-amber-700 text-white"
                      : "text-gray-600 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-800"
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
