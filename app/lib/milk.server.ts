import { db } from "~/lib/db.server";

/** Milk types with how many brews use them, for a simple usage indicator. */
export async function getMilkTypesWithUsage() {
  const milkTypes = await db.milkType.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { brews: true, favorites: true } } },
  });
  return milkTypes;
}
