/** Shared financial and operational rules used by both Convex and the dashboard. */
export const MONEY_SCALE = 100;
export const PERCENTAGE_DIVISOR = 100;
export const MONTHS_PER_YEAR = 12;
export const DEFAULT_LOAN_TERM_MONTHS = 6;
export const PAYOFF_DAYS_PER_MONTH = 30;
export const PAYMENT_MATCH_TOLERANCE = 0.01;
export const INTEREST_CHARGE_WINDOW_DAYS = 14;
export const PAYMENT_REMINDER_WINDOW_DAYS = 14;
export const MAX_MONTHLY_INTEREST_PERIODS = 120;

export const COMBINED_INTEREST_CHARGE_TYPES = [
  "monthly_interest",
  "draw_proration",
] as const;

export function roundCents(value: number) {
  return Math.round(value * MONEY_SCALE) / MONEY_SCALE;
}

export function isCombinedInterestChargeType(type: string) {
  return (COMBINED_INTEREST_CHARGE_TYPES as readonly string[]).includes(type);
}
