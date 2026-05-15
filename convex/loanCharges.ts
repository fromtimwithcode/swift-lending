import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin, requireRole } from "./lib/auth";
import { validateUsDate } from "./lib/dates";
import {
  calculateDrawProration,
  calculateMonthlyInterest,
  calculatePrepaidInterest,
  getCurrentPrincipalOut,
  getFirstMonthlyInterestPeriod,
} from "./lib/loanCalculations";

const chargeStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("paid"),
  v.literal("waived")
);

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
    .withIndex("by_loanId_and_type", (q) =>
      q.eq("loanId", args.loanId).eq("type", args.type)
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

    const principalOut = getCurrentPrincipalOut(loan);
    const monthlyInterest = calculateMonthlyInterest(principalOut, loan.interestRate);
    const prepaid = calculatePrepaidInterest({
      principalOut,
      annualRate: loan.interestRate,
      closeDate: loan.closeDate,
    });
    const firstMonthlyPeriod = getFirstMonthlyInterestPeriod(loan.closeDate);

    await ctx.db.patch(loan._id, { monthlyPayment: monthlyInterest });

    if (prepaid) {
      await upsertSingleLoanCharge(ctx, {
        loanId: loan._id,
        borrowerId: loan.borrowerId,
        type: "prepaid_interest",
        amount: prepaid.amount,
        principalBasis: principalOut,
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

    if (firstMonthlyPeriod) {
      await upsertSingleLoanCharge(ctx, {
        loanId: loan._id,
        borrowerId: loan.borrowerId,
        type: "monthly_interest",
        amount: monthlyInterest,
        principalBasis: principalOut,
        interestRate: loan.interestRate,
        periodStart: firstMonthlyPeriod.periodStart,
        periodEnd: firstMonthlyPeriod.periodEnd,
        dueDate: firstMonthlyPeriod.dueDate,
        notes: "First monthly interest payment after closing.",
        createdBy: args.createdBy,
      });
    }

    return { principalOut, monthlyInterest };
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
    const monthlyInterest = calculateMonthlyInterest(principalOut, loan.interestRate);
    await ctx.db.patch(loan._id, { monthlyPayment: monthlyInterest });

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
    return await ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();
  },
});

export const getMyChargesForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan || loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");

    return await ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();
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
