/**
 * Loan calculation utilities (client-side).
 * Interest-only monthly payment and origination points.
 */

import {
  calculateMonthlyInterest,
  calculatePoints as calculateCanonicalPoints,
} from "@/convex/lib/loanCalculations";

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
