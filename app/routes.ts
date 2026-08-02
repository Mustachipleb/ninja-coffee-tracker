import { type RouteConfig, index, layout, route } from "@react-router/dev/routes";

export default [
  layout("routes/layout.tsx", [
    index("routes/home.tsx"),
    route("brews", "routes/brews.tsx"),
    route("brew-wizard", "routes/brew-wizard.tsx"),
    route("beans", "routes/beans.tsx"),
    route("milks", "routes/milks.tsx"),
    route("favorites", "routes/favorites.tsx"),
    route("users", "routes/users.tsx"),
    route("costs", "routes/costs.tsx"),
  ]),
] satisfies RouteConfig;
