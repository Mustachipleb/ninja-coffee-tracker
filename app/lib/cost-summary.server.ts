import { getUserReconciliations } from "./reconciliation.server";

export type UserCostSummary = {
  id: string;
  name: string;
  brewCount: number;
  totalCents: number;
};

/** Per-person outstanding balance (brewed minus payments). Used by home page and legacy callers. */
export async function getUserCostSummaries(): Promise<UserCostSummary[]> {
  const reconciliations = await getUserReconciliations();
  return reconciliations.map((user) => ({
    id: user.id,
    name: user.name,
    brewCount: user.brewCount,
    totalCents: user.outstandingCents,
  }));
}
