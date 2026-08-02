import { db } from "~/lib/db.server";
import { brewCostCents } from "~/lib/cost";

export type UserCostSummary = {
  id: string;
  name: string;
  brewCount: number;
  totalCents: number;
};

/** Per-person totals across every logged brew, priced from the bean each
 * brew used at the time it was logged. */
export async function getUserCostSummaries(): Promise<UserCostSummary[]> {
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: { brews: { include: { bean: true } } },
  });

  return users.map((user) => {
    const totalCents = user.brews.reduce((sum, brew) => sum + brewCostCents(brew, brew.bean), 0);
    return {
      id: user.id,
      name: user.name,
      brewCount: user.brews.length,
      totalCents,
    };
  });
}
