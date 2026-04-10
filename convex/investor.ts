import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";


export const getMyInvestments = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "investor");
    return await ctx.db
      .query("investments")
      .withIndex("by_investorId", (q) => q.eq("investorId", profile._id))
      .collect();
  },
});

export const getMyInvestment = query({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "investor");
    const investment = await ctx.db.get(args.id);
    if (!investment) throw new Error("Investment not found");
    if (investment.investorId !== profile._id)
      throw new Error("Not your investment");
    return investment;
  },
});

export const getPortfolioStats = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "investor");
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_investorId", (q) => q.eq("investorId", profile._id))
      .collect();

    const totalInvested = investments.reduce(
      (sum, i) => sum + i.investmentAmount,
      0
    );
    const totalPaymentsReceived = investments.reduce(
      (sum, i) => sum + i.totalPaymentsReceived,
      0
    );

    const avgInterestRate =
      investments.length > 0
        ? investments.reduce((sum, i) => sum + i.interestRate, 0) /
          investments.length
        : 0;

    const upcomingPayments = investments
      .map((i) => i.nextPaymentDate)
      .filter((d) => d > Date.now())
      .sort((a, b) => a - b);

    const nextPaymentDate =
      upcomingPayments.length > 0 ? upcomingPayments[0] : null;

    return {
      totalInvested,
      totalPaymentsReceived,
      avgInterestRate,
      nextPaymentDate,
      investmentCount: investments.length,
    };
  },
});

export const getInvestmentStatement = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "investor");
    const investments = await ctx.db
      .query("investments")
      .withIndex("by_investorId", (q) => q.eq("investorId", profile._id))
      .collect();

    const totalInvested = investments.reduce(
      (sum, i) => sum + i.investmentAmount,
      0
    );
    const totalReturns = investments.reduce(
      (sum, i) => sum + i.totalPaymentsReceived,
      0
    );

    // Weighted avg rate
    const weightedRate =
      totalInvested > 0
        ? investments.reduce(
            (sum, i) => sum + i.interestRate * i.investmentAmount,
            0
          ) / totalInvested
        : 0;

    const estAnnualIncome = investments.reduce(
      (sum, i) => sum + (i.investmentAmount * i.interestRate) / 100,
      0
    );

    const breakdown = investments.map((i) => {
      const monthlyReturn = (i.investmentAmount * i.interestRate) / 100 / 12;
      const annualReturn = (i.investmentAmount * i.interestRate) / 100;
      return {
        ...i,
        monthlyReturn,
        annualReturn,
      };
    });

    return {
      totalInvested,
      totalReturns,
      weightedAvgRate: Math.round(weightedRate * 100) / 100,
      estAnnualIncome,
      breakdown,
    };
  },
});
