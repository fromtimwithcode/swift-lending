import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { calculateMonthlyPaymentDue, getCurrentPrincipalOut } from "./lib/loanCalculations";

const BATCH_SIZE = 100;

type LoanChargeDoc = Doc<"loanCharges">;
type LoanPaymentDoc = Doc<"loanPayments">;

function getEligiblePaymentAmount(payment: LoanPaymentDoc) {
  return payment.status === "missed" ? 0 : payment.amount;
}

function getChargesByDueDate(charges: LoanChargeDoc[]) {
  const chargesByDueDate = new Map<string, LoanChargeDoc[]>();
  for (const charge of charges) {
    const existing = chargesByDueDate.get(charge.dueDate);
    if (existing) existing.push(charge);
    else chargesByDueDate.set(charge.dueDate, [charge]);
  }
  return chargesByDueDate;
}

function findChargeToLinkPayment(payment: LoanPaymentDoc, charges: LoanChargeDoc[]) {
  if (payment.chargeId || payment.status === "missed") return undefined;

  const matchingCharges = charges.filter(
    (charge) => charge.status !== "waived" && charge.dueDate === payment.dueDate
  );
  const exactAmountMatch = matchingCharges.find((charge) => Math.abs(charge.amount - payment.amount) < 0.01);
  if (exactAmountMatch) return exactAmountMatch;

  const scheduledMatches = matchingCharges.filter((charge) => charge.status === "scheduled");
  if (scheduledMatches.length === 1) return scheduledMatches[0];
  return matchingCharges.length === 1 ? matchingCharges[0] : undefined;
}

function getPaidAmountForCharge(
  payments: LoanPaymentDoc[],
  charge: LoanChargeDoc,
  chargesByDueDate: Map<string, LoanChargeDoc[]>
) {
  const sameDueDateCharges = chargesByDueDate.get(charge.dueDate)?.filter((item) => item.status !== "waived") ?? [];
  const canCountUnlinkedDueDatePayments = sameDueDateCharges.length === 1;

  return payments.reduce((sum, payment) => {
    if (payment.status === "missed") return sum;
    if (payment.chargeId === charge._id) return sum + payment.amount;
    if (canCountUnlinkedDueDatePayments && !payment.chargeId && payment.dueDate === charge.dueDate) {
      return sum + getEligiblePaymentAmount(payment);
    }
    return sum;
  }, 0);
}

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
      const monthlyPayment = calculateMonthlyPaymentDue({
        principalOut: getCurrentPrincipalOut(loan),
        annualRate: loan.interestRate,
        paymentType: loan.paymentType,
      });
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

/**
 * Backfill period-specific monthly interest charges and link existing payments
 * to the matching charge by due date. Run via:
 * pnpm exec convex run migrations:backfillMonthlyInterestChargesAndPaymentLinks
 */
export const backfillMonthlyInterestChargesAndPaymentLinks = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let loansSynced = 0;
    let paymentsLinked = 0;
    let chargesMarkedPaid = 0;

    for (const loan of results.page) {
      if (loan.closeDate) {
        await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
          loanId: loan._id,
          createdBy: loan.createdBy,
        });
        loansSynced++;
      }

      let payments = await ctx.db
        .query("loanPayments")
        .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
        .collect();
      const charges = await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
        .collect();

      for (const payment of payments) {
        const charge = findChargeToLinkPayment(payment, charges);
        if (!charge) continue;

        await ctx.db.patch(payment._id, { chargeId: charge._id });
        payments = payments.map((item) =>
          item._id === payment._id ? { ...item, chargeId: charge._id } : item
        );
        paymentsLinked++;
      }

      const chargesByDueDate = getChargesByDueDate(charges);
      for (const charge of charges) {
        if (charge.status !== "scheduled") continue;
        const paidAmount = getPaidAmountForCharge(payments, charge, chargesByDueDate);
        if (paidAmount + 0.01 < charge.amount) continue;

        await ctx.db.patch(charge._id, { status: "paid" });
        chargesMarkedPaid++;
      }
    }

    if (!results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillMonthlyInterestChargesAndPaymentLinks,
        { cursor: results.continueCursor }
      );
    }

    return { loansSynced, paymentsLinked, chargesMarkedPaid, isDone: results.isDone };
  },
});
