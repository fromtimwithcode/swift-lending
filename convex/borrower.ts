import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireRole } from "./lib/auth";
import { internal } from "./_generated/api";
import { formatCurrencyPlain, isDrawEligibleLoan, STRATEGY_LABELS } from "./lib/constants";
import { getAppConfigurationState } from "./lib/settings";
import { notifyTeam } from "./lib/notifications";
import { calculateMonthlyInterest, calculatePoints } from "./lib/loanCalculations";
import { getMaturityDate, validateUsDate } from "./lib/dates";
import {
  getPropertyDetailsError,
  PROPERTY_TYPE_LABELS,
} from "./lib/propertyDetails";
import {
  propertyTypeValidator,
  propertyUnitDetailsValidator,
} from "./lib/propertyValidators";
import { getFundingLedgerStatus } from "./lib/fundingLedger";

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

function requiredString(value: string, label: string) {
  const normalized = optionalString(value);
  if (!normalized) throw new ConvexError(`${label} is required`);
  return normalized;
}

function requiredEmail(value: string, label: string) {
  const email = optionalEmail(value, label);
  if (!email) throw new ConvexError(`${label} is required`);
  return email;
}

function optionalDetail(value: string | undefined) {
  return value?.trim() || "Not provided";
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
    afterRepairValue: v.number(),
    rehabBudgetTotal: v.optional(v.number()),
    terms: v.string(),
    notes: v.optional(v.string()),
    isTitleOpen: v.optional(v.boolean()),
    titleCompanyName: v.string(),
    titleCompanyContact: v.string(),
    titleCompanyContactEmail: v.string(),
    titleCompanyContactPhone: v.string(),
    titlePreference: v.optional(v.string()),
    isUnderContract: v.optional(v.boolean()),
    acquisitionType: v.optional(v.union(v.literal("wholesaler"), v.literal("direct_to_seller"))),
    desiredCloseDate: v.string(),
    strategy: v.union(v.literal("flip_and_resell"), v.literal("brrrr")),
    propertyType: propertyTypeValidator,
    bedrooms: v.number(),
    bathrooms: v.number(),
    squareFeetAboveGrade: v.number(),
    squareFeetBelowGrade: v.number(),
    unitDetails: propertyUnitDetailsValidator,
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
    const titleCompanyName = requiredString(args.titleCompanyName, "Title company");
    const titleCompanyContact = requiredString(args.titleCompanyContact, "Title contact");
    const titleCompanyContactEmail = requiredEmail(args.titleCompanyContactEmail, "Title contact email");
    const titleCompanyContactPhone = requiredString(args.titleCompanyContactPhone, "Title contact phone");
    const desiredCloseDate = requiredString(args.desiredCloseDate, "Close date");

    if (!entityName) throw new ConvexError("Entity name cannot be empty");
    if (!propertyAddress) throw new ConvexError("Property address cannot be empty");
    if (!terms) throw new ConvexError("Terms cannot be empty");
    validateUsDate(desiredCloseDate, "Close date", { allowFuture: true });

    const propertyDetailsError = getPropertyDetailsError(args);
    if (propertyDetailsError) throw new ConvexError(propertyDetailsError);

    const totalLoanAmount = args.loanAmount;

    if (totalLoanAmount <= 0) throw new ConvexError("Total loan amount must be greater than 0");
    if (args.purchasePrice < 0) throw new ConvexError("Purchase price cannot be negative");
    if (args.rehabBudgetTotal !== undefined && args.rehabBudgetTotal < 0) {
      throw new ConvexError("Rehab budget cannot be negative");
    }
    if (args.afterRepairValue < args.purchasePrice) {
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
    const { configuration, version: configurationVersion } =
      await getAppConfigurationState(ctx);
    const { loanDefaults } = configuration;
    const interestRate = loanDefaults.annualInterestRate;
    const monthlyPayment = calculateMonthlyInterest(totalLoanAmount, interestRate);
    const pointsEarned = calculatePoints(
      totalLoanAmount,
      loanDefaults.originationPointsPercentage
    );

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
      paymentDueDay: loanDefaults.paymentDueDay,
      pointsEarned,
      pointsPercentage: loanDefaults.originationPointsPercentage,
      loanTermMonths: loanDefaults.loanTermMonths,
      configurationVersion,
      paymentType: "monthly",
      status: "submitted",
      notes,
      titleCompany: titleCompanyName,
      titleCompanyContact,
      titleCompanyContactEmail,
      titleCompanyContactPhone,
      isTitleOpen: true,
      titleCompanyName,
      isUnderContract: args.isUnderContract,
      acquisitionType: args.acquisitionType,
      strategy: args.strategy,
      propertyType: args.propertyType,
      bedrooms: args.bedrooms,
      bathrooms: args.bathrooms,
      squareFeetAboveGrade: args.squareFeetAboveGrade,
      squareFeetBelowGrade: args.squareFeetBelowGrade,
      unitDetails: args.unitDetails,
      closeDate: desiredCloseDate,
      maturityDate: getMaturityDate(desiredCloseDate, loanDefaults.loanTermMonths),
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

    const applicationDetails = [
      { label: "Borrower", value: profile.displayName },
      { label: "Property address", value: propertyAddress },
      { label: "Purchase price", value: formatCurrencyPlain(args.purchasePrice) },
      { label: "Rehab amount", value: formatCurrencyPlain(args.rehabBudgetTotal ?? 0) },
      { label: "ARV", value: formatCurrencyPlain(args.afterRepairValue) },
      { label: "Total loan amount", value: formatCurrencyPlain(totalLoanAmount) },
      { label: "Strategy", value: STRATEGY_LABELS[args.strategy] },
      { label: "Property type", value: PROPERTY_TYPE_LABELS[args.propertyType] },
      { label: "Desired close date", value: optionalDetail(desiredCloseDate) },
      { label: "Title company", value: titleCompanyName },
    ];

    const teamProfileEmails = await notifyTeam(ctx, {
      type: "application_submitted",
      title: "New Loan Application",
      body: `${profile.displayName} submitted a loan application for ${propertyAddress}. Purchase price: ${formatCurrencyPlain(args.purchasePrice)}. Rehab: ${formatCurrencyPlain(args.rehabBudgetTotal ?? 0)}. ARV: ${formatCurrencyPlain(args.afterRepairValue)}. Desired close: ${desiredCloseDate}. Title company: ${titleCompanyName}.`,
      loanId: id,
      details: applicationDetails,
      actionPath: `/dashboard/admin/loans/${id}`,
      actionLabel: "View Application",
      sendSms: true,
      sendExternalEmail: false,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: profile._id,
      type: "application_submitted",
      title: "Loan Application Received",
      body: `We received your loan application for ${propertyAddress}. It is under review, and we'll notify you when the status changes.`,
      loanId: id,
      dedupeKey: `application_received:${id}`,
      sendSms: true,
    });

    // Send alert email to external recipients
    await ctx.scheduler.runAfter(0, internal.email.sendLoanApplicationAlert, {
      borrowerName: profile.displayName,
      propertyAddress,
      purchasePrice: args.purchasePrice,
      rehabBudgetTotal: args.rehabBudgetTotal ?? 0,
      afterRepairValue: args.afterRepairValue,
      desiredCloseDate,
      titleCompany: titleCompanyName,
      loanAmount: totalLoanAmount,
      loanId: id,
      excludeEmails: teamProfileEmails,
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
    if (!isDrawEligibleLoan(loan)) {
      throw new ConvexError("Loan is not eligible for draw requests");
    }
    if (!Number.isFinite(args.amountRequested) || args.amountRequested <= 0) {
      throw new ConvexError("Draw amount must be greater than 0");
    }

    const trimmedDescription = args.workDescription.trim();
    if (!trimmedDescription) throw new ConvexError("Work description cannot be empty");

    const existingDraws: Doc<"drawRequests">[] = [];
    for await (const draw of ctx.db
      .query("drawRequests")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))) {
      existingDraws.push(draw);
    }
    const ledgerStatus = getFundingLedgerStatus({
      savedDrawFundsUsed: loan.drawFundsUsed,
      draws: existingDraws,
    });
    if (!ledgerStatus.isReconciled) {
      throw new ConvexError(
        "Draw requests are temporarily unavailable. Contact your lending team."
      );
    }

    // Validate amount against available funds (total - used - pending).
    if (loan.drawFundsTotal !== undefined) {
      const pendingTotal = existingDraws
        .filter((d) => d.status === "pending" || d.status === "under_review")
        .reduce((sum, d) => sum + d.amountRequested, 0);
      const available = loan.drawFundsTotal - ledgerStatus.recordedTotal - pendingTotal;
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
      source: "request",
    });

    await notifyTeam(ctx, {
      type: "draw_submitted",
      title: "New Draw Request",
      body: `${profile.displayName} submitted a draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}.`,
      loanId: args.loanId,
      drawRequestId: id,
      details: [
        { label: "Borrower", value: profile.displayName },
        { label: "Property address", value: loan.propertyAddress },
        { label: "Amount requested", value: formatCurrencyPlain(args.amountRequested) },
        { label: "Work description", value: trimmedDescription },
      ],
      actionPath: `/dashboard/admin/draws/${id}`,
      actionLabel: "Review Draw Request",
      sendSms: true,
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: profile._id,
      type: "draw_submitted",
      title: "Draw Request Received",
      body: `We received your draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}. We'll notify you when the status changes.`,
      loanId: args.loanId,
      drawRequestId: id,
      dedupeKey: `draw_received:${id}`,
      sendSms: true,
    });

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
