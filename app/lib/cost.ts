import { BASKET_GRAMS, type BasketSize } from "./basket-size";

/** Minimal shape needed to price a brew: the bean's total cost & weight. */
export type PricedBean = { priceCents: number; weightGrams: number };

/** Minimal shape needed to price milk: its price per liter. */
export type PricedMilk = { pricePerLiterCents: number };

/** Cost in cents to brew with 1 gram of the given bag of beans. */
export function pricePerGramCents(bean: PricedBean): number {
  if (bean.weightGrams <= 0) return 0;
  return bean.priceCents / bean.weightGrams;
}

/** Cost in cents of the beans used for a given basket size. */
export function beanCostCents(basketSize: BasketSize, bean: PricedBean): number {
  return BASKET_GRAMS[basketSize] * pricePerGramCents(bean);
}

/** Cost in cents of the milk used in a brew, if any was added. */
export function milkCostCents(milkVolumeMl: number | null | undefined, milk: PricedMilk | null | undefined): number {
  if (!milkVolumeMl || !milk) return 0;
  return (milkVolumeMl / 1000) * milk.pricePerLiterCents;
}

/** Total cost in cents of a single brew: beans + milk (if used). */
export function brewCostCents(
  brew: { basketSize: BasketSize; milkVolumeMl?: number | null },
  bean: PricedBean,
  milk?: PricedMilk | null,
): number {
  return beanCostCents(brew.basketSize, bean) + milkCostCents(brew.milkVolumeMl, milk);
}
