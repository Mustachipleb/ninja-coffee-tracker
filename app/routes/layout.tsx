import { NavLink, Outlet } from "react-router";

const NAV_LINKS = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/brews", label: "Brews" },
  { to: "/beans", label: "Beans" },
  { to: "/milks", label: "Milks" },
  { to: "/favorites", label: "Favorites" },
  { to: "/users", label: "People" },
  { to: "/costs", label: "Costs" },
];

export default function AppLayout() {
  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100">
      <header className="border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4">
          <span className="text-lg font-bold tracking-tight text-amber-700 dark:text-amber-500">
            ☕ Ninja Coffee Tracker
          </span>
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
