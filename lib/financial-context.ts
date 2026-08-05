export const FINANCIAL_CONTEXT = {
  currentPrincipalOut:
    "Loan amount minus the total draw holdback, plus funded draws, capped at the loan amount.",
  currentMonthlyPayment:
    "For monthly-pay loans, this is the next full-month interest using today’s principal and saved annual rate. Balloon loans show $0 because interest is collected at payoff.",
  currentMonthlyInterest:
    "A next full-month estimate using today’s principal and saved annual rate. A billed month can differ because its charge uses principal outstanding on the first day of that month.",
  monthlyAccrual:
    "Estimated interest accruing for the next full month using today’s principal and saved annual rate. It is collected at payoff, not as a monthly payment.",
  chargeSchedule:
    "A billed monthly-interest charge uses principal outstanding on the first day of its billed month. Draw proration includes the funded draw’s wire date through month-end; charges sharing a due date combine into one payment.",
  payoffEstimate:
    "Planning estimate: today’s principal plus 30/360 accrued interest, less logged payments. Because today’s principal is applied across the elapsed period, loans with later draws need an exact payoff review.",
  totalInterestEarned:
    "The recorded lifetime interest received for this loan. This value is included in closed-loan revenue reporting.",
  capitalOut:
    "Current principal outstanding on funded, sent-to-title, and closed loans whose funds have not been returned.",
  drawsRemaining:
    "Unused draw capacity on funded, sent-to-title, and non-matured closed loans: total draw funds minus draws already funded.",
  closedLoanRevenue:
    "Recorded origination points plus total interest earned for loans marked closed.",
  monthlyCashFlow:
    "Estimated next full-month interest across funded, sent-to-title, and non-matured closed loans, using each loan’s current principal and saved annual rate. It is not cash already collected or an existing billed amount.",
  pipelineValue:
    "Total loan amount from submission through sent-to-title, excluding denied, closed, and returned loans.",
  totalDue:
    "Sum of unpaid reminders in this card’s past-due and upcoming window. Monthly interest and draw proration sharing a due date are combined.",
} as const;
