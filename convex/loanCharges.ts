import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireRole } from "./lib/auth";
import { formatCurrencyPlain } from "./lib/constants";
import { parseUsDate, validateUsDate } from "./lib/dates";
import {
  calculateDrawProration,
  calculateMonthlyInterest,
  calculateMonthlyPaymentDue,
  calculatePrepaidInterest,
  getCurrentPrincipalOut,
  getMonthlyInterestPeriods,
} from "./lib/loanCalculations";

const MONTHLY_CHARGE_WINDOW_DAYS = 14;
const MAX_MONTHLY_INTEREST_CHARGES = 120;
const SYNC_BATCH_SIZE = 25;

const chargeStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("paid"),
  v.literal("waived")
);

function getChargeWindowEnd() {
  const windowEnd = new Date();
  windowEnd.setHours(0, 0, 0, 0);
  windowEnd.setDate(windowEnd.getDate() + MONTHLY_CHARGE_WINDOW_DAYS);
  return windowEnd;
}

function getPrincipalOutForPeriodStart(
  loan: Doc<"loans">,
  drawRequests: Doc<"drawRequests">[],
  periodStart: Date
) {
  const datedApprovedDraws = drawRequests.filter((draw) => draw.status === "approved" && draw.wireDate);
  if (datedApprovedDraws.length === 0) return getCurrentPrincipalOut(loan);

  const drawFundsUsed = datedApprovedDraws.reduce((sum, draw) => {
    const wireDate = parseUsDate(draw.wireDate ?? "");
    if (!wireDate || wireDate >= periodStart) return sum;
    return sum + draw.amountRequested;
  }, 0);

  return getCurrentPrincipalOut({
    loanAmount: loan.loanAmount,
    drawFundsTotal: loan.drawFundsTotal,
    drawFundsUsed,
  });
}

async function upsertSingleLoanCharge(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    borrowerId: Id<"userProfiles">;
    type: "prepaid_interest" | "monthly_interest";
    amount: number;
    principalBasis: number;
    interestRate: number;
    periodStart: string;
    periodEnd: string;
    dueDate: string;
    perDiem?: number;
    daysCharged?: number;
    notes?: string;
    status?: "scheduled" | "paid" | "waived";
    createdBy: Id<"userProfiles">;
  }
) {
  const existing = await ctx.db
    .query("loanCharges")
    .withIndex("by_loanId_and_type_and_dueDate", (q) =>
      q.eq("loanId", args.loanId).eq("type", args.type).eq("dueDate", args.dueDate)
    )
    .first();

  const charge = {
    loanId: args.loanId,
    borrowerId: args.borrowerId,
    type: args.type,
    amount: args.amount,
    principalBasis: args.principalBasis,
    interestRate: args.interestRate,
    periodStart: args.periodStart,
    periodEnd: args.periodEnd,
    dueDate: args.dueDate,
    status: args.status ?? "scheduled",
    perDiem: args.perDiem,
    daysCharged: args.daysCharged,
    notes: args.notes,
    createdBy: args.createdBy,
  };

  if (existing) {
    if (existing.status !== "waived") {
      await ctx.db.patch(existing._id, {
        ...charge,
        status: args.status ?? existing.status,
      });
    }
    return existing._id;
  }

  return await ctx.db.insert("loanCharges", charge);
}

export const syncInitialInterestCharges = internalMutation({
  args: {
    loanId: v.id("loans"),
    createdBy: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan || !loan.closeDate) return null;

    const currentPrincipalOut = getCurrentPrincipalOut(loan);
    const monthlyInterest = calculateMonthlyInterest(currentPrincipalOut, loan.interestRate);
    const monthlyPayment = calculateMonthlyPaymentDue({
      principalOut: currentPrincipalOut,
      annualRate: loan.interestRate,
      paymentType: loan.paymentType,
    });
    const drawRequests = await ctx.db
      .query("drawRequests")
      .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
      .collect();
    const closeDate = parseUsDate(loan.closeDate);
    const prepaidPrincipalOut = closeDate
      ? getPrincipalOutForPeriodStart(loan, drawRequests, closeDate)
      : currentPrincipalOut;
    const prepaid = calculatePrepaidInterest({
      principalOut: prepaidPrincipalOut,
      annualRate: loan.interestRate,
      closeDate: loan.closeDate,
    });
    const monthlyPeriods = getMonthlyInterestPeriods({
      closeDate: loan.closeDate,
      maturityDate: loan.maturityDate,
      paymentDueDay: loan.paymentDueDay,
      windowEnd: getChargeWindowEnd(),
      maxPeriods: MAX_MONTHLY_INTEREST_CHARGES,
    });

    await ctx.db.patch(loan._id, { monthlyPayment });

    if (prepaid) {
      await upsertSingleLoanCharge(ctx, {
        loanId: loan._id,
        borrowerId: loan.borrowerId,
        type: "prepaid_interest",
        amount: prepaid.amount,
        principalBasis: prepaidPrincipalOut,
        interestRate: loan.interestRate,
        periodStart: prepaid.periodStart,
        periodEnd: prepaid.periodEnd,
        dueDate: prepaid.dueDate,
        perDiem: prepaid.perDiem,
        daysCharged: prepaid.daysCharged,
        notes: "Prepaid interest collected at closing.",
        status: "paid",
        createdBy: args.createdBy,
      });
    }

    if ((loan.paymentType ?? "monthly") !== "balloon") {
      for (const period of monthlyPeriods) {
        const periodPrincipalOut = getPrincipalOutForPeriodStart(loan, drawRequests, period.periodStartDate);
        const periodMonthlyInterest = calculateMonthlyInterest(periodPrincipalOut, loan.interestRate);
        if (periodMonthlyInterest <= 0) continue;

        await upsertSingleLoanCharge(ctx, {
          loanId: loan._id,
          borrowerId: loan.borrowerId,
          type: "monthly_interest",
          amount: periodMonthlyInterest,
          principalBasis: periodPrincipalOut,
          interestRate: loan.interestRate,
          periodStart: period.periodStart,
          periodEnd: period.periodEnd,
          dueDate: period.dueDate,
          notes: "Monthly interest payment after closing.",
          createdBy: args.createdBy,
        });
      }
    }

    return { principalOut: currentPrincipalOut, monthlyInterest, monthlyChargesSynced: monthlyPeriods.length };
  },
});

export const syncInterestChargesForActiveLoans = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: SYNC_BATCH_SIZE, cursor: args.cursor ?? null });

    let queued = 0;
    for (const loan of results.page) {
      if (!loan.closeDate || loan.returnedDate) continue;

      await ctx.scheduler.runAfter(0, internal.loanCharges.syncInitialInterestCharges, {
        loanId: loan._id,
        createdBy: loan.createdBy,
      });
      queued++;
    }

    if (!results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.loanCharges.syncInterestChargesForActiveLoans,
        { cursor: results.continueCursor }
      );
    }

    return { queued, isDone: results.isDone };
  },
});

export const recordDrawProration = internalMutation({
  args: {
    loanId: v.id("loans"),
    drawRequestId: v.id("drawRequests"),
    wireDate: v.string(),
    createdBy: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    validateUsDate(args.wireDate, "Wire date", { allowFuture: true });

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    const draw = await ctx.db.get(args.drawRequestId);
    if (!draw) throw new ConvexError("Draw request not found");
    if (draw.loanId !== loan._id) throw new ConvexError("Draw does not belong to loan");

    const principalOut = getCurrentPrincipalOut(loan);
    const monthlyPayment = calculateMonthlyPaymentDue({
      principalOut,
      annualRate: loan.interestRate,
      paymentType: loan.paymentType,
    });
    await ctx.db.patch(loan._id, { monthlyPayment });

    if ((loan.paymentType ?? "monthly") === "balloon") return null;

    const existing = await ctx.db
      .query("loanCharges")
      .withIndex("by_drawRequestId", (q) => q.eq("drawRequestId", draw._id))
      .first();
    if (existing) return existing._id;

    const proration = calculateDrawProration({
      drawAmount: draw.amountRequested,
      annualRate: loan.interestRate,
      wireDate: args.wireDate,
    });
    if (!proration || proration.amount <= 0) return null;

    return await ctx.db.insert("loanCharges", {
      loanId: loan._id,
      borrowerId: loan.borrowerId,
      drawRequestId: draw._id,
      type: "draw_proration",
      amount: proration.amount,
      principalBasis: draw.amountRequested,
      interestRate: loan.interestRate,
      periodStart: proration.periodStart,
      periodEnd: proration.periodEnd,
      dueDate: proration.dueDate,
      status: "scheduled",
      perDiem: proration.perDiem,
      daysCharged: proration.daysCharged,
      notes: "Prorated interest from draw wire date through month end.",
      createdBy: args.createdBy,
    });
  },
});

export const getChargesForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const charges = await ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();

    return charges.filter((charge) => charge.status !== "waived");
  },
});

export const getMyChargesForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan || loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");

    const charges = await ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();

    return charges.filter((charge) => charge.status !== "waived");
  },
});

export const updateChargeStatus = mutation({
  args: {
    id: v.id("loanCharges"),
    status: chargeStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const charge = await ctx.db.get(args.id);
    if (!charge) throw new ConvexError("Charge not found");
    await ctx.db.patch(args.id, { status: args.status });
    return args.id;
  },
});

export const removeCharge = mutation({
  args: { id: v.id("loanCharges") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const charge = await ctx.db.get(args.id);
    if (!charge) throw new ConvexError("Charge not found");
    if (charge.status === "waived") return args.id;

    const relatedPayments = await ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", charge.loanId))
      .collect();
    const hasRelatedPayment = relatedPayments.some(
      (payment) => payment.chargeId === args.id || (!payment.chargeId && payment.dueDate === charge.dueDate)
    );
    if (hasRelatedPayment) {
      throw new ConvexError("Remove related payment records before deleting this charge");
    }

    await ctx.db.patch(args.id, { status: "waived" });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "charge.remove",
      entityType: "loan",
      entityId: charge.loanId,
      details: `Removed ${charge.type} charge for ${formatCurrencyPlain(charge.amount)} due ${charge.dueDate}`,
    });

    return args.id;
  },
});
