import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { roundCents } from "./financialRules";
import {
  type CalendarDay,
  summarizeInvestment,
  type InvestmentSummary,
  type InvestmentTerms,
} from "./investmentSchedule";

const MAX_INVESTMENTS_PER_INVESTOR = 100;
const MAX_PAYOUTS_PER_INVESTMENT = 1000;

async function getInvestmentPayouts(ctx: QueryCtx, investmentId: Id<"investments">) {
  return await ctx.db
    .query("investorPayouts")
    .withIndex("by_investmentId_and_paidDate", (q) => q.eq("investmentId", investmentId))
    .order("desc")
    .take(MAX_PAYOUTS_PER_INVESTMENT);
}

function sum(values: number[]) {
  return roundCents(values.reduce((total, value) => total + value, 0));
}

function summarizePortfolio(
  investments: (InvestmentTerms & { summary: InvestmentSummary })[]
) {
  const totalInvested = sum(investments.map((investment) => investment.investmentAmount));
  const nextDueDate = Math.min(
    ...investments.flatMap((investment) => investment.summary.nextPayment?.dueDate ?? [])
  );
  return {
    totalInvested,
    avgInterestRate:
      totalInvested > 0
        ? roundCents(
            investments.reduce(
              (total, investment) => total + investment.interestRate * investment.investmentAmount,
              0
            ) / totalInvested
          )
        : 0,
    monthlyPayments: sum(investments.map((investment) => investment.summary.monthlyPayment)),
    annualInterest: sum(investments.map((investment) => investment.summary.annualInterest)),
    interestEarned: sum(investments.map((investment) => investment.summary.interestEarned)),
    paidToDate: sum(investments.map((investment) => investment.summary.paidToDate)),
    unpaidInterest: sum(investments.map((investment) => investment.summary.unpaidInterest)),
    pastDueAmount: sum(investments.map((investment) => investment.summary.pastDue?.amount ?? 0)),
    nextPayment: Number.isFinite(nextDueDate)
      ? {
          dueDate: nextDueDate,
          amount: sum(
            investments.map((investment) =>
              investment.summary.nextPayment?.dueDate === nextDueDate
                ? investment.summary.nextPayment.amount
                : 0
            )
          ),
        }
      : null,
  };
}

type PortfolioInput<InvestmentId, Payout> = InvestmentTerms & {
  _id: InvestmentId;
  notes?: string;
  payouts: Payout[];
};

export function buildInvestorPortfolio<InvestmentId, Payout extends { amount: number }>(
  investments: PortfolioInput<InvestmentId, Payout>[],
  today: CalendarDay
) {
  const rows = investments
    .map((investment) => ({
      ...investment,
      summary: summarizeInvestment(
        investment,
        investment.payouts.map((payout) => payout.amount),
        today
      ),
    }))
    .sort((a, b) => a.inceptionDate - b.inceptionDate);
  return { today, investments: rows, totals: summarizePortfolio(rows) };
}

export async function loadInvestorPortfolio(
  ctx: QueryCtx,
  investorId: Id<"userProfiles">,
  today: CalendarDay
) {
  const investments = await ctx.db
    .query("investments")
    .withIndex("by_investorId", (q) => q.eq("investorId", investorId))
    .take(MAX_INVESTMENTS_PER_INVESTOR);
  const rows = await Promise.all(
    investments.map(async (investment) => ({
      ...investment,
      payouts: (await getInvestmentPayouts(ctx, investment._id)).map(
        ({ _id, amount, paidDate, method, notes }) => ({ _id, amount, paidDate, method, notes })
      ),
    }))
  );
  return buildInvestorPortfolio(rows, today);
}
