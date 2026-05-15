import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { calculateMonthlyInterest, getCurrentPrincipalOut } from "./lib/loanCalculations";

const BATCH_SIZE = 100;

/**
 * Backfill paymentType on existing loans that don't have it set.
 * Run via: npx convex run migrations:backfillPaymentType
 */
export const backfillPaymentType = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let updated = 0;
    for (const loan of results.page) {
      if (loan.paymentType === undefined) {
        await ctx.db.patch(loan._id, { paymentType: "monthly" });
        updated++;
      }
    }

    if (!results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillPaymentType,
        { cursor: results.continueCursor }
      );
    }

    return { updated, isDone: results.isDone };
  },
});

/**
 * Backfill interest charges and current monthly payment for existing loans with close dates.
 * Run via: pnpm exec convex run migrations:backfillInterestCharges
 */
export const backfillInterestCharges = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let updated = 0;
    for (const loan of results.page) {
      const monthlyPayment = calculateMonthlyInterest(
        getCurrentPrincipalOut(loan),
        loan.interestRate
      );
      if (loan.monthlyPayment !== monthlyPayment) {
        await ctx.db.patch(loan._id, { monthlyPayment });
        updated++;
      }
      if (loan.closeDate) {
        await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
          loanId: loan._id,
          createdBy: loan.createdBy,
        });
      }
    }

    if (!results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillInterestCharges,
        { cursor: results.continueCursor }
      );
    }

    return { updated, isDone: results.isDone };
  },
});
