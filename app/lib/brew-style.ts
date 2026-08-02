import { BrewStyle } from "../../generated/prisma/enums";

export { BrewStyle };

/** Human-friendly labels for the Ninja Luxe Premier's brew style presets. */
export const BREW_STYLE_LABELS: Record<BrewStyle, string> = {
  [BrewStyle.CLASSIC]: "Classic",
  [BrewStyle.RICH]: "Rich",
  [BrewStyle.OVER_ICE]: "Over Ice",
  [BrewStyle.SPECIALTY]: "Specialty (Latte/Cappuccino)",
  [BrewStyle.COLD_BREW]: "Cold Brew",
};

export const BREW_STYLE_OPTIONS = Object.values(BrewStyle).map((value) => ({
  value,
  label: BREW_STYLE_LABELS[value],
}));

export function isBrewStyle(value: unknown): value is BrewStyle {
  return typeof value === "string" && value in BREW_STYLE_LABELS;
}
