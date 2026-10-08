import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { PAYMENT_METHOD_LABELS } from "@/convex/lib/constants";
import { formatCalendarDay } from "@/convex/lib/investmentSchedule";
import { formatCurrency } from "@/lib/format";

type Portfolio = FunctionReturnType<typeof api.investments.getMyPortfolio>;

export function getPortfolioRows({ investments, today }: Portfolio) {
  return investments.map((investment) => {
    const next = investment.summary.nextPayment;
    return {
      _id: investment._id,
      investmentAmount: investment.investmentAmount,
      interestRate: investment.interestRate,
      inceptionDate: investment.inceptionDate,
      monthlyPayment: investment.summary.monthlyPayment,
      annualInterest: investment.summary.annualInterest,
      nextPaymentDate: next?.dueDate ?? Number.POSITIVE_INFINITY,
      nextPaymentLabel: next
        ? `${formatCurrency(next.amount)} ${next.dueDate === today ? "due today" : `on ${formatCalendarDay(next.dueDate)}`}`
        : "None",
      interestEarned: investment.summary.interestEarned,
      paidToDate: investment.summary.paidToDate,
      notes: investment.notes,
    };
  });
}

export type PortfolioRow = ReturnType<typeof getPortfolioRows>[number];

export function getPayoutHistory({ investments }: Portfolio) {
  return investments
    .flatMap((investment) =>
      investment.payouts.map((payout) => ({
        _id: payout._id,
        paidDate: payout.paidDate,
        amount: payout.amount,
        method: PAYMENT_METHOD_LABELS[payout.method],
        reference: payout.notes,
        investment: `${formatCurrency(investment.investmentAmount)} at ${investment.interestRate}%`,
      }))
    )
    .sort((a, b) => b.paidDate - a.paidDate);
}

export type PayoutHistoryRow = ReturnType<typeof getPayoutHistory>[number];
