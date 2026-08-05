/**
 * Loan calculation utilities (client-side).
 * Interest-only monthly payment, origination points, and payoff estimate.
 */

import { parseUsDate } from "./dates";
import {
  calculateMonthlyInterest,
  calculatePoints as calculateCanonicalPoints,
  roundCents,
} from "@/convex/lib/loanCalculations";
import {
  MONTHS_PER_YEAR,
  PAYOFF_DAYS_PER_MONTH,
  PERCENTAGE_DIVISOR,
} from "@/convex/lib/financialRules";

/** Calculate interest-only monthly payment */
export function calculateMonthlyPayment(
  loanAmount: number,
  annualRate: number
): number {
  return calculateMonthlyInterest(loanAmount, annualRate);
}

/** Calculate origination points (fee) */
export function calculatePoints(
  loanAmount: number,
  pointsPercentage: number
): number {
  return calculateCanonicalPoints(loanAmount, pointsPercentage);
}

export interface PayoffEstimate {
  principal: number;
  accruedInterest: number;
  totalPayoff: number;
  monthsAccrued: number;
}

/**
 * Calculate payoff estimate using 30/360 day-count convention.
 * Returns null if data is insufficient.
 */
export function calculatePayoffEstimate(
  principalOut: number,
  annualRate: number,
  closeDate: string | undefined,
  asOfDate: Date,
  totalPaymentsReceived: number
): PayoffEstimate | null {
  if (!closeDate || principalOut <= 0 || annualRate <= 0) return null;

  const parsedCloseDate = parseUsDate(closeDate);
  if (!parsedCloseDate || parsedCloseDate > asOfDate) return null;

  const closeMonth = parsedCloseDate.getMonth() + 1;
  const closeDay = parsedCloseDate.getDate();
  const closeYear = parsedCloseDate.getFullYear();

  const asOfMonth = asOfDate.getMonth() + 1;
  const asOfDay = asOfDate.getDate();
  const asOfYear = asOfDate.getFullYear();

  // 30/360 day count: months = (Y2-Y1)*12 + (M2-M1) + (D2-D1)/30
  const monthsAccrued =
    (asOfYear - closeYear) * MONTHS_PER_YEAR +
    (asOfMonth - closeMonth) +
    (asOfDay - closeDay) / PAYOFF_DAYS_PER_MONTH;

  if (monthsAccrued <= 0) return null;

  const monthlyRate = annualRate / PERCENTAGE_DIVISOR / MONTHS_PER_YEAR;
  const totalInterest = monthlyRate * principalOut * monthsAccrued;

  // Payment history reduces unpaid interest for both payment structures.
  const accruedInterest = Math.max(
    0,
    roundCents(totalInterest - totalPaymentsReceived)
  );

  const totalPayoff = roundCents(principalOut + accruedInterest);

  return {
    principal: principalOut,
    accruedInterest,
    totalPayoff,
    monthsAccrued: Math.round(monthsAccrued * 10) / 10,
  };
}
