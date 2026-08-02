import { db } from "./db.server";
import { brewCostCents } from "./cost";

export type UserReconciliation = {
  id: string;
  name: string;
  brewCount: number;
  totalBrewedCents: number;
  totalPaidCents: number;
  outstandingCents: number;
};

export async function getPaymentSettings() {
  return db.appSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      paymentRecipient: "",
      paymentIban: "",
      paymentBic: null,
      paymentReference: "Ninja Coffee",
    },
  });
}

export async function getUserReconciliations(): Promise<UserReconciliation[]> {
  const users = await db.user.findMany({
    orderBy: { name: "asc" },
    include: {
      brews: { include: { bean: true, milkType: true } },
      payments: true,
    },
  });

  return users.map((user) => {
    const totalBrewedCents = user.brews.reduce(
      (sum, brew) => sum + brewCostCents(brew, brew.bean, brew.milkType),
      0,
    );
    const totalPaidCents = user.payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    const outstandingCents = totalBrewedCents - totalPaidCents;
    return {
      id: user.id,
      name: user.name,
      brewCount: user.brews.length,
      totalBrewedCents,
      totalPaidCents,
      outstandingCents,
    };
  });
}
