import { BasketSize } from "../../generated/prisma/enums";

export { BasketSize };

/** Approximate grams of ground coffee the Ninja Luxe Premier uses for each
 * basket size. Used to derive bean usage/cost without asking users to weigh
 * anything themselves. */
export const BASKET_GRAMS: Record<BasketSize, number> = {
  [BasketSize.SINGLE]: 9,
  [BasketSize.DOUBLE]: 18,
  [BasketSize.LUXE]: 40,
};

export const BASKET_SIZE_LABELS: Record<BasketSize, string> = {
  [BasketSize.SINGLE]: `Single basket (~${BASKET_GRAMS.SINGLE}g)`,
  [BasketSize.DOUBLE]: `Double basket (~${BASKET_GRAMS.DOUBLE}g)`,
  [BasketSize.LUXE]: `Luxe basket (~${BASKET_GRAMS.LUXE}g)`,
};

export const BASKET_SIZE_OPTIONS = Object.values(BasketSize).map((value) => ({
  value,
  label: BASKET_SIZE_LABELS[value],
}));

export function isBasketSize(value: unknown): value is BasketSize {
  return typeof value === "string" && value in BASKET_GRAMS;
}

/** Grams of ground coffee used by a brew/favorite for its basket size. */
export function gramsForBasket(basketSize: BasketSize): number {
  return BASKET_GRAMS[basketSize];
}
