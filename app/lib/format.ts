const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/** Formats an integer amount of cents as a "$1.23" style currency string. */
export function formatCents(cents: number): string {
  return currencyFormatter.format(cents / 100);
}

/** Formats a gram amount, trimming trailing zeros (e.g. "18.5g"). */
export function formatGrams(grams: number): string {
  return `${Number(grams.toFixed(2)).toString()}g`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(date: Date | string): string {
  return dateTimeFormatter.format(new Date(date));
}
