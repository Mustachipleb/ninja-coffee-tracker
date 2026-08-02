/** Minimal shape needed to price a brew: the bean's total cost & weight. */
export type PricedBean = { priceCents: number; weightGrams: number };

/** Cost in cents to brew with 1 gram of the given bag of beans. */
export function pricePerGramCents(bean: PricedBean): number {
  if (bean.weightGrams <= 0) return 0;
  return bean.priceCents / bean.weightGrams;
}

/** Cost in cents of a single brew, based on the bean it was made from. */
export function brewCostCents(brew: { grindAmountGrams: number }, bean: PricedBean): number {
  return brew.grindAmountGrams * pricePerGramCents(bean);
}
