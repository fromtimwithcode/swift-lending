import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireRole, getAdminLikeUsers } from "./lib/auth";
import { internal } from "./_generated/api";
import { formatCurrencyPlain, DEFAULT_POINTS_PERCENTAGE, DEFAULT_PAYMENT_DUE_DAY, isDrawEligibleLoanStatus } from "./lib/constants";
import { getDefaultInterestRate } from "./lib/settings";

function getMonthlyPayment(loanAmount: number, interestRate: number) {
  return Math.round((interestRate / 100 / 12) * loanAmount * 100) / 100;
}

function getPointsEarned(loanAmount: number) {
  return Math.round((DEFAULT_POINTS_PERCENTAGE / 100) * loanAmount * 100) / 100;
}

function optionalString(value: string | undefined) {
  return value?.trim() || undefined;
}

function optionalEmail(value: string | undefined, label: string) {
  const email = optionalString(value)?.toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ConvexError(`${label} must be a valid email address`);
  }
  return email;
}

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
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");
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
    titleCompanyContact: v.optional(v.string()),
    titleCompanyContactEmail: v.optional(v.string()),
    titleCompanyContactPhone: v.optional(v.string()),
    titlePreference: v.optional(v.string()),
    isUnderContract: v.optional(v.boolean()),
    acquisitionType: v.optional(v.union(v.literal("wholesaler"), v.literal("direct_to_seller"))),
    desiredCloseDate: v.optional(v.string()),
    photoFileIds: v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
    })),
    entityDocumentFileIds: v.optional(v.array(v.object({
      storageId: v.id("_storage"),
      fileName: v.string(),
      fileSize: v.optional(v.number()),
      type: v.union(v.literal("articles"), v.literal("operating_agreement")),
    }))),
  },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");

    // Trim string inputs
    const entityName = args.entityName.trim();
    const propertyAddress = args.propertyAddress.trim();
    const terms = args.terms.trim();
    const notes = optionalString(args.notes);
    const titleCompanyName = args.isTitleOpen ? optionalString(args.titleCompanyName) : undefined;
    const titleCompanyContact = args.isTitleOpen ? optionalString(args.titleCompanyContact) : undefined;
    const titleCompanyContactEmail = args.isTitleOpen
      ? optionalEmail(args.titleCompanyContactEmail, "Title contact email")
      : undefined;
    const titleCompanyContactPhone = args.isTitleOpen ? optionalString(args.titleCompanyContactPhone) : undefined;
    const titlePreference = args.isTitleOpen === false ? optionalString(args.titlePreference) : undefined;
    const desiredCloseDate = optionalString(args.desiredCloseDate);

    if (!entityName) throw new ConvexError("Entity name cannot be empty");
    if (!propertyAddress) throw new ConvexError("Property address cannot be empty");
    if (!terms) throw new ConvexError("Terms cannot be empty");

    const totalLoanAmount = args.loanAmount;

    if (totalLoanAmount <= 0) throw new ConvexError("Total loan amount must be greater than 0");
    if (args.purchasePrice < 0) throw new ConvexError("Purchase price cannot be negative");
    if (args.rehabBudgetTotal !== undefined && args.rehabBudgetTotal < 0) {
      throw new ConvexError("Rehab budget cannot be negative");
    }
    if (args.afterRepairValue !== undefined && args.afterRepairValue < args.purchasePrice) {
      throw new ConvexError("After repair value should not be less than purchase price");
    }
    if (args.photoFileIds.length === 0) {
      throw new ConvexError("At least one property photo is required");
    }
    if (args.photoFileIds.length > 50) {
      throw new ConvexError("Maximum 50 photos allowed per application");
    }
    if ((args.entityDocumentFileIds?.length ?? 0) > 20) {
      throw new ConvexError("Maximum 20 LLC documents allowed per application");
    }
    for (const doc of args.entityDocumentFileIds ?? []) {
      if (!doc.fileName.trim()) throw new ConvexError("Document file name cannot be empty");
      if (doc.fileSize !== undefined && doc.fileSize < 0) {
        throw new ConvexError("Document file size cannot be negative");
      }
    }

    // Calculate default financial fields
    const interestRate = await getDefaultInterestRate(ctx);
    const monthlyPayment = getMonthlyPayment(totalLoanAmount, interestRate);
    const pointsEarned = getPointsEarned(totalLoanAmount);

    const id = await ctx.db.insert("loans", {
      borrowerId: profile._id,
      borrowerName: profile.displayName,
      entityName,
      propertyAddress,
      purchasePrice: args.purchasePrice,
      loanAmount: totalLoanAmount,
      afterRepairValue: args.afterRepairValue,
      rehabBudgetTotal: args.rehabBudgetTotal,
      terms,
      interestRate,
      monthlyPayment,
      paymentDueDay: DEFAULT_PAYMENT_DUE_DAY,
      pointsEarned,
      paymentType: "monthly",
      status: "submitted",
      notes,
      titleCompany: titleCompanyName,
      titleCompanyContact,
      titleCompanyContactEmail,
      titleCompanyContactPhone,
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

    for (const doc of args.entityDocumentFileIds ?? []) {
      await ctx.db.insert("documents", {
        ownerId: profile._id,
        loanId: id,
        type: doc.type,
        fileId: doc.storageId,
        fileName: doc.fileName.trim(),
        fileSize: doc.fileSize,
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

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: profile._id,
      type: "application_submitted",
      title: "Loan Application Received",
      body: `We received your loan application for ${propertyAddress}. We'll review it and email you when the status changes.`,
      loanId: id,
      dedupeKey: `application_received:${id}`,
    });

    // Send alert email to external recipients
    await ctx.scheduler.runAfter(0, internal.email.sendLoanApplicationAlert, {
      borrowerName: profile.displayName,
      propertyAddress,
      loanAmount: totalLoanAmount,
      loanId: id,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: profile._id,
      userName: profile.displayName,
      action: "application.submit",
      entityType: "loan",
      entityId: id,
      details: `Submitted loan application for ${propertyAddress} (${formatCurrencyPlain(totalLoanAmount)})`,
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
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");

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
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");
    if (!isDrawEligibleLoanStatus(loan.status)) {
      throw new ConvexError("Loan is not eligible for draw requests");
    }
    if (!Number.isFinite(args.amountRequested) || args.amountRequested <= 0) {
      throw new ConvexError("Draw amount must be greater than 0");
    }

    const trimmedDescription = args.workDescription.trim();
    if (!trimmedDescription) throw new ConvexError("Work description cannot be empty");

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
        throw new ConvexError(
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

export const isRepeatEntity = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan || loan.borrowerId !== profile._id) throw new ConvexError("Not found");
    if (!loan.entityName?.trim()) return false;
    const allLoans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();
    return allLoans.some(
      (l) =>
        l._id !== args.loanId &&
        l.entityName?.trim().toLowerCase() === loan.entityName.trim().toLowerCase()
    );
  },
});

export const getMyLoanPayments = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "borrower");
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.borrowerId !== profile._id) throw new ConvexError("Not your loan");

    return await ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();
  },
});
