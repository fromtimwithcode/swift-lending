import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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
