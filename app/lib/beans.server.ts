import { db } from "~/lib/db.server";
import { pricePerGramCents } from "~/lib/cost";

/** Beans annotated with how many grams have been used and the derived
 * per-gram cost, so callers don't have to repeat the aggregation logic. */
export async function getBeansWithUsage() {
  const beans = await db.bean.findMany({
    orderBy: { createdAt: "desc" },
    include: { brews: { select: { grindAmountGrams: true } } },
  });

  return beans.map((bean) => {
    const usedGrams = bean.brews.reduce((sum, b) => sum + b.grindAmountGrams, 0);
    const remainingGrams = Math.max(bean.weightGrams - usedGrams, 0);
    const { brews: _brews, ...rest } = bean;
    return {
      ...rest,
      usedGrams,
      remainingGrams,
      pricePerGramCents: pricePerGramCents(bean),
    };
  });
}
