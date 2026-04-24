/**
 * Loan calculation utilities (client-side).
 * Interest-only monthly payment, origination points, and payoff estimate.
 */

/** Calculate interest-only monthly payment */
export function calculateMonthlyPayment(
  loanAmount: number,
  annualRate: number
): number {
  if (loanAmount <= 0 || annualRate <= 0) return 0;
  return Math.round((annualRate / 100 / 12) * loanAmount * 100) / 100;
}

/** Calculate origination points (fee) */
export function calculatePoints(
  loanAmount: number,
  pointsPercentage: number
): number {
  if (loanAmount <= 0 || pointsPercentage <= 0) return 0;
  return Math.round((pointsPercentage / 100) * loanAmount * 100) / 100;
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
  loanAmount: number,
  annualRate: number,
  closeDate: string | undefined,
  asOfDate: Date,
  paymentType: "balloon" | "monthly",
  totalPaymentsReceived: number
): PayoffEstimate | null {
  if (!closeDate || loanAmount <= 0 || annualRate <= 0) return null;

  // Parse close date (MM/DD/YYYY format)
  const parts = closeDate.split("/");
  if (parts.length !== 3) return null;
  const closeMonth = parseInt(parts[0], 10);
  const closeDay = parseInt(parts[1], 10);
  const closeYear = parseInt(parts[2], 10);
  if (isNaN(closeMonth) || isNaN(closeDay) || isNaN(closeYear)) return null;

  const asOfMonth = asOfDate.getMonth() + 1;
  const asOfDay = asOfDate.getDate();
  const asOfYear = asOfDate.getFullYear();

  // 30/360 day count: months = (Y2-Y1)*12 + (M2-M1) + (D2-D1)/30
  const monthsAccrued =
    (asOfYear - closeYear) * 12 +
    (asOfMonth - closeMonth) +
    (asOfDay - closeDay) / 30;

  if (monthsAccrued <= 0) return null;

  const monthlyRate = annualRate / 100 / 12;
  const totalInterest = monthlyRate * loanAmount * monthsAccrued;

  // For balloon: all interest accrues, minus any payments already made
  // For monthly: only unpaid interest (total interest minus payments received)
  const accruedInterest = Math.max(
    0,
    Math.round((totalInterest - totalPaymentsReceived) * 100) / 100
  );

  const totalPayoff = Math.round((loanAmount + accruedInterest) * 100) / 100;

  return {
    principal: loanAmount,
    accruedInterest,
    totalPayoff,
    monthsAccrued: Math.round(monthsAccrued * 10) / 10,
  };
}
