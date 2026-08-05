import {
  MONTHS_PER_YEAR,
  PAYMENT_MATCH_TOLERANCE,
  PAYOFF_DAYS_PER_MONTH,
} from "./financialRules";
import type { AppConfiguration } from "./appConfiguration";

export type CalculationGuideSectionId =
  | "principal"
  | "interest"
  | "payments"
  | "payoff"
  | "reporting"
  | "comps";

interface GuideDefault {
  label: string;
  value: string;
  detail: string;
}

interface GuideRule {
  name: string;
  formula: string;
  detail: string;
}

interface GuideSection {
  id: CalculationGuideSectionId;
  title: string;
  description: string;
  rules: GuideRule[];
}

function formatOrdinal(value: number) {
  const remainder100 = value % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
}

export function getCalculationGuide(configuration: AppConfiguration) {
  const { loanDefaults, operations, comparables } = configuration;
  const defaults: GuideDefault[] = [
    {
      label: "Default interest rate",
      value: `${loanDefaults.annualInterestRate}%`,
      detail: "Used for new loans. Existing loans keep their saved interest rate.",
    },
    {
      label: "Origination points",
      value: `${loanDefaults.originationPointsPercentage}%`,
      detail: `${loanDefaults.originationPointsPercentage} points equals ${loanDefaults.originationPointsPercentage}% of the total loan amount.`,
    },
    {
      label: "Default payment day",
      value: `${formatOrdinal(loanDefaults.paymentDueDay)} of the month`,
      detail: "A loan’s saved payment day takes priority. Short months use the last day.",
    },
    {
      label: "Standard loan term",
      value: `${loanDefaults.loanTermMonths} months`,
      detail: "New loan forms suggest this maturity date, which can be adjusted.",
    },
  ];

  const sections: GuideSection[] = [
    {
      id: "principal",
      title: "Loan amounts & fees",
      description: "How loan balances, draw availability, points, and maturity dates are calculated.",
      rules: [
        {
          name: "Suggested loan amount",
          formula: "Purchase price + rehab budget",
          detail: "New loan and application forms fill this amount automatically. It can be adjusted before submission.",
        },
        {
          name: "Principal outstanding",
          formula: "Total loan amount − construction holdback + funded draws",
          detail: "The amount is rounded to cents and cannot be less than $0 or more than the total loan amount.",
        },
        {
          name: "Draw funds available",
          formula: "Construction holdback − funded draws − pending draw requests",
          detail: "Pending and under-review requests temporarily reduce the amount available for another draw.",
        },
        {
          name: "Origination points",
          formula: `Total loan amount × ${loanDefaults.originationPointsPercentage}%`,
          detail: "Swift Capital recalculates points when the total loan amount changes.",
        },
        {
          name: "Suggested maturity date",
          formula: `Closing date + ${loanDefaults.loanTermMonths} calendar months`,
          detail: "If that date does not exist in the maturity month, the last day of the month is used.",
        },
        {
          name: "Rounding",
          formula: "Dollar amounts are rounded to the nearest cent",
          detail: "This applies to interest, daily rates, charges, points, payoff estimates, and payment balances.",
        },
      ],
    },
    {
      id: "interest",
      title: "Interest & due dates",
      description: "How monthly interest, daily interest, closing interest, and draw adjustments are prepared.",
      rules: [
        {
          name: "Monthly interest",
          formula: `Principal outstanding × annual interest rate ÷ 100 ÷ ${MONTHS_PER_YEAR}`,
          detail: "Uses the interest rate saved on the loan and rounds the monthly amount to cents.",
        },
        {
          name: "Monthly payment due",
          formula: "Monthly interest for monthly-pay loans; $0 for balloon loans",
          detail: "Balloon-loan interest is due at payoff rather than through monthly interest payments.",
        },
        {
          name: "Daily interest (per diem)",
          formula: "Rounded monthly interest ÷ number of days in that month",
          detail: "The daily amount is rounded to cents before it is multiplied by the number of chargeable days.",
        },
        {
          name: "Interest collected at closing",
          formula: "Daily interest × closing date through month-end, including both dates",
          detail: "This charge is due on the closing date and is shown as paid because it is collected at closing.",
        },
        {
          name: "Full-month interest payment",
          formula: `Principal outstanding on the first day of the month × annual rate ÷ 100 ÷ ${MONTHS_PER_YEAR}`,
          detail: "A draw funded on or after the first day is excluded from that opening balance and handled as a separate draw adjustment.",
        },
        {
          name: "First full monthly payment",
          formula: "Covers the first full calendar month after closing and is due the following month",
          detail: "Uses the payment day saved on the loan and moves to month-end when a short month does not contain that day.",
        },
        {
          name: "Draw interest adjustment",
          formula: "Draw daily interest × funding date through month-end, including both dates",
          detail: "The adjustment is due with the next monthly payment on the loan’s saved payment day.",
        },
        {
          name: "When upcoming charges appear",
          formula: `Regular monthly charges are prepared when their due date is within ${operations.interestChargeWindowDays} days`,
          detail: "Swift Capital checks active loans daily. Draw interest adjustments are created when the draw is approved.",
        },
      ],
    },
    {
      id: "payments",
      title: "Applying payments & reminders",
      description: "How one received payment is applied to monthly interest and draw adjustments.",
      rules: [
        {
          name: "One payment for the same due date",
          formula: "Monthly interest + all draw adjustments due on the same date",
          detail: "Admins collect one payment while each charge remains a separate line item in the loan history.",
        },
        {
          name: "Amount remaining",
          formula: "Charges due − payments applied to those charges",
          detail: "Missed payments count as $0. A payment assigned to another charge is not included.",
        },
        {
          name: "When charges are marked paid",
          formula: `A remaining difference of $${PAYMENT_MATCH_TOLERANCE.toFixed(2)} or less is treated as paid`,
          detail: "A complete combined payment marks every monthly-interest and draw-adjustment charge for that due date as paid.",
        },
        {
          name: "Payment applied to one charge",
          formula: "A payment assigned to one charge can satisfy that charge by itself",
          detail: "This supports partial payments while the other charges for the same due date remain open.",
        },
        {
          name: "Paid and waived charge history",
          formula: "Loan and draw recalculation updates open charge amounts only",
          detail: "Later loan or draw edits do not change the amount recorded on a paid or waived charge.",
        },
        {
          name: "Payment reminders",
          formula: `Begin ${operations.paymentReminderWindowDays} days before the due date and remain while a balance is open`,
          detail: "Admin and borrower reminders show the same combined amount still due, including past-due balances.",
        },
        {
          name: "Suggested payment status",
          formula: "Late after the due date; on time on or before the due date",
          detail: "Admins can still record a payment as on time, late, partial, or missed.",
        },
      ],
    },
    {
      id: "payoff",
      title: "Payoff planning estimate",
      description: "A planning figure shown on loan details. It is not a formal payoff statement.",
      rules: [
        {
          name: "Time used for interest",
          formula: `(Year difference × ${MONTHS_PER_YEAR}) + month difference + day difference ÷ ${PAYOFF_DAYS_PER_MONTH}`,
          detail: "This is the 30/360 method: each month is treated as 30 days and each year as 360 days.",
        },
        {
          name: "Estimated interest since closing",
          formula: "Current principal outstanding × monthly interest rate × elapsed months",
          detail: "This simplified estimate uses today’s principal for the full period. Loans with draws funded after closing may require a manual payoff review.",
        },
        {
          name: "Payments included",
          formula: "Non-missed payments received on or before the estimate date",
          detail: "Future-dated and missed payments are excluded from the estimate.",
        },
        {
          name: "Estimated payoff amount",
          formula: "Current principal outstanding + unpaid estimated interest",
          detail: "The result is rounded to cents. Confirm the exact amount before issuing a payoff statement.",
        },
      ],
    },
    {
      id: "reporting",
      title: "Dashboard & investor reporting",
      description: "How monthly cash flow, closed-loan revenue, and investor estimates are summarized.",
      rules: [
        {
          name: "Loans included in monthly cash flow",
          formula: "Funded and sent-to-title loans, plus closed loans whose maturity date has not passed",
          detail: "Loans with returned funds are excluded. Closed loans without a valid maturity date are also excluded.",
        },
        {
          name: "Monthly cash flow",
          formula: `Sum of each included loan’s principal × its saved annual rate ÷ 100 ÷ ${MONTHS_PER_YEAR}`,
          detail: "Each loan uses its own saved interest rate, not the default rate for new loans.",
        },
        {
          name: "Weighted average loan rate",
          formula: "Sum of principal × rate ÷ total principal outstanding",
          detail: "Larger outstanding loan balances have a proportionally larger effect on the displayed rate.",
        },
        {
          name: "Closed-loan revenue",
          formula: "Origination points + total interest recorded on closed loans",
          detail: "Uses the total interest value saved when the loan is closed.",
        },
        {
          name: "Investor weighted average rate",
          formula: "Sum of investment amount × rate ÷ total invested",
          detail: "Larger investments have a proportionally larger effect on the portfolio rate.",
        },
        {
          name: "Estimated investor returns",
          formula: `Annual = investment amount × rate ÷ 100; monthly = annual ÷ ${MONTHS_PER_YEAR}`,
          detail: "Payments already received are tracked separately from these estimated returns.",
        },
      ],
    },
    {
      id: "comps",
      title: "Comparable property ranking",
      description: "How Swift Capital ranks its own loans to find the most relevant property comparisons.",
      rules: [
        {
          name: "Loans eligible for comparison",
          formula: "Closed, funded, and sent-to-title loans with an address and purchase price",
          detail: "The loan being reviewed is excluded from its own comparison list.",
        },
        {
          name: "Location",
          formula: `Same state +${comparables.sameState} points; same city +${comparables.sameCity} points`,
          detail: `A matching city and state contributes up to ${comparables.sameState + comparables.sameCity} points.`,
        },
        {
          name: "Property values",
          formula: `Purchase price: up to ${comparables.purchasePrice} points; after-repair value: up to ${comparables.afterRepairValue} points; rehab budget: up to ${comparables.rehabBudget} points`,
          detail: `Points decrease at ${comparables.similarityPenaltyMultiplier} times the percentage difference. A missing value earns 0 points for that category.`,
        },
        {
          name: "Loan status",
          formula: `Closed: +${comparables.statusClosed} points; funded: +${comparables.statusFunded} points; sent to title: +${comparables.statusSentToTitle} points`,
          detail: "Status points favor completed loans while keeping recently funded loans available for comparison.",
        },
        {
          name: "Recency",
          formula: `Starts at ${comparables.recencyMax} points and loses ${comparables.recencyPointsLostPerMonth} point per 30-day month`,
          detail: "Uses the closing date when available and the loan-created date otherwise. Recency cannot reduce the score below 0.",
        },
        {
          name: "Final ranking",
          formula: `Score is rounded and capped at ${comparables.maxScore}; the top ${comparables.maxResults} matches are shown`,
          detail: "Higher scores indicate a closer match to the loan being reviewed.",
        },
      ],
    },
  ];

  return { defaults, sections };
}
