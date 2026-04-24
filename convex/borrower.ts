import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, getAdminLikeUsers } from "./lib/auth";
import { internal } from "./_generated/api";
import { formatCurrencyPlain } from "./lib/constants";

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
    isTitleOpen: v.optional(v.boolean()),
    titleCompanyName: v.optional(v.string()),
    titlePreference: v.optional(v.string()),
    isUnderContract: v.optional(v.boolean()),
    acquisitionType: v.optional(v.union(v.literal("wholesaler"), v.literal("direct_to_seller"))),
    desiredCloseDate: v.optional(v.string()),
    photoFileIds: v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
    })),
  },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");

    // Trim string inputs
    const entityName = args.entityName.trim();
    const propertyAddress = args.propertyAddress.trim();
    const terms = args.terms.trim();
    const notes = args.notes?.trim() || undefined;
    const titleCompanyName = args.titleCompanyName?.trim() || undefined;
    const titlePreference = args.titlePreference?.trim() || undefined;
    const desiredCloseDate = args.desiredCloseDate?.trim() || undefined;

    if (!entityName) throw new Error("Entity name cannot be empty");
    if (!propertyAddress) throw new Error("Property address cannot be empty");
    if (!terms) throw new Error("Terms cannot be empty");

    if (args.loanAmount <= 0) throw new Error("Loan amount must be greater than 0");
    if (args.purchasePrice < 0) throw new Error("Purchase price cannot be negative");
    if (args.afterRepairValue !== undefined && args.afterRepairValue < args.purchasePrice) {
      throw new Error("After repair value should not be less than purchase price");
    }
    if (args.photoFileIds.length === 0) {
      throw new Error("At least one property photo is required");
    }
    if (args.photoFileIds.length > 20) {
      throw new Error("Maximum 20 photos allowed per application");
    }

    const id = await ctx.db.insert("loans", {
      borrowerId: profile._id,
      borrowerName: profile.displayName,
      entityName,
      propertyAddress,
      purchasePrice: args.purchasePrice,
      loanAmount: args.loanAmount,
      afterRepairValue: args.afterRepairValue,
      rehabBudgetTotal: args.rehabBudgetTotal,
      terms,
      interestRate: 0,
      monthlyPayment: 0,
      pointsEarned: 0,
      status: "submitted",
      notes,
      isTitleOpen: args.isTitleOpen,
      titleCompanyName,
      titlePreference,
      isUnderContract: args.isUnderContract,
      acquisitionType: args.acquisitionType,
      desiredCloseDate,
      createdBy: profile._id,
    });

    // Create document records for uploaded photos
    for (const photo of args.photoFileIds) {
      await ctx.db.insert("documents", {
        ownerId: profile._id,
        loanId: id,
        type: "property_photo",
        fileId: photo.storageId,
        fileName: photo.fileName,
      });
    }

    // Notify all admins/developers
    const adminLikeUsers = await getAdminLikeUsers(ctx);
    for (const admin of adminLikeUsers) {
      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: admin._id,
        type: "application_submitted",
        title: "New Loan Application",
        body: `${profile.displayName} submitted a loan application for ${propertyAddress}.`,
        loanId: id,
      });
    }

    // Send alert email to external recipients
    await ctx.scheduler.runAfter(0, internal.email.sendLoanApplicationAlert, {
      borrowerName: profile.displayName,
      propertyAddress,
      loanId: id,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: profile._id,
      userName: profile.displayName,
      action: "application.submit",
      entityType: "loan",
      entityId: id,
      details: `Submitted loan application for ${propertyAddress} (${formatCurrencyPlain(args.loanAmount)})`,
    });

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

    // Batch-load unique loans instead of N+1
    const loanIds = [...new Set(draws.map((d) => d.loanId))];
    const loanMap = new Map(
      (await Promise.all(loanIds.map((id) => ctx.db.get(id)))).map((l, i) => [loanIds[i], l])
    );

    return draws.map((draw) => ({
      ...draw,
      propertyAddress: loanMap.get(draw.loanId)?.propertyAddress ?? "Unknown",
    }));
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
    if (args.amountRequested <= 0) throw new Error("Draw amount must be greater than 0");

    const trimmedDescription = args.workDescription.trim();
    if (!trimmedDescription) throw new Error("Work description cannot be empty");

    // Validate amount against available funds (total - used - pending)
    if (loan.drawFundsTotal !== undefined) {
      const existingDraws = await ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .collect();
      const pendingTotal = existingDraws
        .filter((d) => d.status === "pending" || d.status === "under_review")
        .reduce((sum, d) => sum + d.amountRequested, 0);
      const available = loan.drawFundsTotal - (loan.drawFundsUsed ?? 0) - pendingTotal;
      if (args.amountRequested > available) {
        throw new Error(
          `Draw amount exceeds available funds. Available: ${formatCurrencyPlain(available)}`
        );
      }
    }

    const id = await ctx.db.insert("drawRequests", {
      loanId: args.loanId,
      borrowerId: profile._id,
      amountRequested: args.amountRequested,
      workDescription: trimmedDescription,
      status: "pending",
    });

    // Notify all admins/developers of new draw request
    const adminLikeUsers = await getAdminLikeUsers(ctx);
    for (const admin of adminLikeUsers) {
      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: admin._id,
        type: "draw_submitted",
        title: "New Draw Request",
        body: `${profile.displayName} submitted a draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}.`,
        loanId: args.loanId,
        drawRequestId: id,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: profile._id,
      userName: profile.displayName,
      action: "draw.submit",
      entityType: "draw",
      entityId: id,
      details: `Submitted draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}`,
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
