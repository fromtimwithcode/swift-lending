import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  DEFAULT_LOAN_TERM_MONTHS,
  isCombinedInterestChargeType,
  PAYMENT_MATCH_TOLERANCE,
  roundCents,
} from "./lib/financialRules";
import type { Doc } from "./_generated/dataModel";
import {
  calculateMonthlyPaymentDue,
  getCurrentPrincipalOut,
  getEffectivePointsPercentage,
} from "./lib/loanCalculations";
import { DEFAULT_PAYMENT_DUE_DAY } from "./lib/constants";
import { APP_CONFIGURATION_SCOPE } from "./lib/appConfiguration";
import { getAppConfigurationState } from "./lib/settings";

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
  const exactAmountMatch = matchingCharges.find(
    (charge) =>
      Math.abs(charge.amount - payment.amount) < PAYMENT_MATCH_TOLERANCE
  );
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

function getFullyFundedCombinedInterestGroups(
  charges: LoanChargeDoc[],
  payments: LoanPaymentDoc[]
) {
  const groupsByDueDate = new Map<string, LoanChargeDoc[]>();
  for (const charge of charges) {
    if (
      charge.status === "waived" ||
      !isCombinedInterestChargeType(charge.type)
    ) {
      continue;
    }
    const existing = groupsByDueDate.get(charge.dueDate);
    if (existing) existing.push(charge);
    else groupsByDueDate.set(charge.dueDate, [charge]);
  }

  return [...groupsByDueDate.entries()].flatMap(([dueDate, groupCharges]) => {
    const scheduledCharges = groupCharges.filter(
      (charge) => charge.status === "scheduled"
    );
    if (scheduledCharges.length === 0) return [];

    const chargeIds = new Set(groupCharges.map((charge) => charge._id));
    const totalAmount = roundCents(
      groupCharges.reduce((sum, charge) => sum + charge.amount, 0)
    );
    const paidAmount = roundCents(
      payments.reduce((sum, payment) => {
        if (payment.dueDate !== dueDate || payment.status === "missed") {
          return sum;
        }
        if (payment.chargeId && !chargeIds.has(payment.chargeId)) return sum;
        return sum + payment.amount;
      }, 0)
    );
    if (paidAmount + PAYMENT_MATCH_TOLERANCE < totalAmount) return [];

    return [{ dueDate, scheduledCharges, totalAmount, paidAmount }];
  });
}

/**
 * Seed the versioned configuration from the legacy interest-rate setting and
 * current fallback policy. Run first with { dryRun: true }.
 */
export const seedAppConfiguration = internalMutation({
  args: { dryRun: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const state = await getAppConfigurationState(ctx);
    if (state.record) {
      return { inserted: false, version: state.version, configuration: state.configuration };
    }
    if (args.dryRun) {
      return { inserted: false, wouldInsert: true, version: 1, configuration: state.configuration };
    }

    const now = Date.now();
    await ctx.db.insert("appConfiguration", {
      scope: APP_CONFIGURATION_SCOPE,
      version: 1,
      comparablesVersion: 0,
      configuration: state.configuration,
      updatedAt: now,
    });
    return { inserted: true, version: 1, configuration: state.configuration };
  },
});

/**
 * Backfill immutable policy snapshots without recalculating contractual values.
 * Existing loans retain their saved rate, points earned, maturity date, charges,
 * and payments. Run first with { dryRun: true }.
 */
export const backfillLoanConfigurationSnapshots = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let wouldUpdate = 0;
    for (const loan of results.page) {
      const patch: {
        paymentDueDay?: number;
        pointsPercentage?: number;
        loanTermMonths?: number;
        configurationVersion?: number;
      } = {};
      if (loan.paymentDueDay === undefined) patch.paymentDueDay = DEFAULT_PAYMENT_DUE_DAY;
      if (loan.pointsPercentage === undefined) {
        patch.pointsPercentage = getEffectivePointsPercentage({
          loanAmount: loan.loanAmount,
          pointsEarned: loan.pointsEarned,
        });
      }
      if (loan.loanTermMonths === undefined) patch.loanTermMonths = DEFAULT_LOAN_TERM_MONTHS;
      if (loan.configurationVersion === undefined) patch.configurationVersion = 0;
      if (Object.keys(patch).length === 0) continue;

      wouldUpdate++;
      if (!args.dryRun) await ctx.db.patch(loan._id, patch);
    }

    if (!args.dryRun && !results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.backfillLoanConfigurationSnapshots,
        { cursor: results.continueCursor }
      );
    }

    return {
      dryRun: args.dryRun ?? false,
      updated: args.dryRun ? 0 : wouldUpdate,
      wouldUpdate,
      isDone: results.isDone,
      continueCursor: results.isDone ? null : results.continueCursor,
    };
  },
});

export const auditLoanConfigurationSnapshots = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });
    const incompleteLoanIds = results.page
      .filter(
        (loan) =>
          loan.paymentDueDay === undefined ||
          loan.pointsPercentage === undefined ||
          loan.loanTermMonths === undefined ||
          loan.configurationVersion === undefined
      )
      .map((loan) => loan._id);

    return {
      incompleteLoanIds,
      isDone: results.isDone,
      continueCursor: results.isDone ? null : results.continueCursor,
    };
  },
});

/**
 * Reconcile historical combined interest payments. A single payment can cover
 * monthly interest plus draw proration for the same due date, even when it is
 * linked to only one of those charges. Run first with { dryRun: true }.
 */
export const reconcileCombinedInterestChargeStatuses = internalMutation({
  args: {
    cursor: v.optional(v.string()),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });

    let eligibleGroups = 0;
    let chargesWouldUpdate = 0;
    for (const loan of results.page) {
      const [charges, payments] = await Promise.all([
        ctx.db
          .query("loanCharges")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect(),
        ctx.db
          .query("loanPayments")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect(),
      ]);
      const groups = getFullyFundedCombinedInterestGroups(charges, payments);
      eligibleGroups += groups.length;

      for (const group of groups) {
        chargesWouldUpdate += group.scheduledCharges.length;
        if (args.dryRun) continue;
        for (const charge of group.scheduledCharges) {
          await ctx.db.patch(charge._id, { status: "paid" });
        }
      }
    }

    if (!args.dryRun && !results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.migrations.reconcileCombinedInterestChargeStatuses,
        { cursor: results.continueCursor }
      );
    }

    return {
      dryRun: args.dryRun ?? false,
      eligibleGroups,
      chargesUpdated: args.dryRun ? 0 : chargesWouldUpdate,
      chargesWouldUpdate,
      isDone: results.isDone,
      continueCursor: results.isDone ? null : results.continueCursor,
    };
  },
});

export const auditCombinedInterestChargeStatuses = internalQuery({
  args: { cursor: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: BATCH_SIZE, cursor: args.cursor ?? null });
    const incompleteGroups = [];

    for (const loan of results.page) {
      const [charges, payments] = await Promise.all([
        ctx.db
          .query("loanCharges")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect(),
        ctx.db
          .query("loanPayments")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect(),
      ]);
      for (const group of getFullyFundedCombinedInterestGroups(
        charges,
        payments
      )) {
        incompleteGroups.push({
          loanId: loan._id,
          dueDate: group.dueDate,
          scheduledChargeIds: group.scheduledCharges.map(
            (charge) => charge._id
          ),
          totalAmount: group.totalAmount,
          paidAmount: group.paidAmount,
        });
      }
    }

    return {
      incompleteGroups,
      isDone: results.isDone,
      continueCursor: results.isDone ? null : results.continueCursor,
    };
  },
});

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
        if (paidAmount + PAYMENT_MATCH_TOLERANCE < charge.amount) continue;

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
