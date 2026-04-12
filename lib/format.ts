/** Abbreviated currency: $1.2M, $45K, $900 */
export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/** Full currency: $1,200,000 */
export function formatCurrency(value: number): string {
  return "$" + value.toLocaleString();
}
