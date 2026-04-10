import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole } from "./lib/auth";
import { internal } from "./_generated/api";

export const getMyLoans = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "borrower");
    return await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();
  },
});

export const getMyLoan = query({
  args: { id: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.id);
    if (!loan) throw new Error("Loan not found");
    if (loan.borrowerId !== profile._id) throw new Error("Not your loan");
    return loan;
  },
});

export const submitApplication = mutation({
  args: {
    entityName: v.string(),
    propertyAddress: v.string(),
    purchasePrice: v.number(),
    loanAmount: v.number(),
    afterRepairValue: v.optional(v.number()),
    rehabBudgetTotal: v.optional(v.number()),
    terms: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");

    const id = await ctx.db.insert("loans", {
      borrowerId: profile._id,
      borrowerName: profile.displayName,
      entityName: args.entityName,
      propertyAddress: args.propertyAddress,
      purchasePrice: args.purchasePrice,
      loanAmount: args.loanAmount,
      afterRepairValue: args.afterRepairValue,
      rehabBudgetTotal: args.rehabBudgetTotal,
      terms: args.terms,
      interestRate: 0,
      monthlyPayment: 0,
      pointsEarned: 0,
      status: "submitted",
      notes: args.notes,
      createdBy: profile._id,
    });

    // Notify all admins
    const admins = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "admin"))
      .collect();
    for (const admin of admins) {
      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: admin._id,
        type: "application_submitted",
        title: "New Loan Application",
        body: `${profile.displayName} submitted a loan application for ${args.propertyAddress}.`,
        loanId: id,
      });
    }

    return id;
  },
});

export const getMyDrawRequests = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "borrower");
    const draws = await ctx.db
      .query("drawRequests")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();

    // Attach loan propertyAddress
    const enriched = await Promise.all(
      draws.map(async (draw) => {
        const loan = await ctx.db.get(draw.loanId);
        return {
          ...draw,
          propertyAddress: loan?.propertyAddress ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const getDrawRequestsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.borrowerId !== profile._id) throw new Error("Not your loan");

    return await ctx.db
      .query("drawRequests")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();
  },
});

export const submitDrawRequest = mutation({
  args: {
    loanId: v.id("loans"),
    amountRequested: v.number(),
    workDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.borrowerId !== profile._id) throw new Error("Not your loan");
    if (loan.status !== "funded") throw new Error("Loan must be funded to request draws");

    const id = await ctx.db.insert("drawRequests", {
      loanId: args.loanId,
      borrowerId: profile._id,
      amountRequested: args.amountRequested,
      workDescription: args.workDescription,
      status: "pending",
    });

    return id;
  },
});

export const getMyLoanPayments = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.borrowerId !== profile._id) throw new Error("Not your loan");

    return await ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();
  },
});
