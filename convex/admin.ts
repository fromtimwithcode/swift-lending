import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_BULK_OPERATION_SIZE, LOAN_STATUS_LABELS, formatCurrencyPlain } from "./lib/constants";

const loanStatusValidator = v.union(
  v.literal("submitted"),
  v.literal("under_review"),
  v.literal("additional_info_needed"),
  v.literal("approved"),
  v.literal("denied"),
  v.literal("funded"),
  v.literal("sent_to_title"),
  v.literal("closed")
);

export const getOverviewStats = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    // TODO(scale): Unbounded .collect() — paginate or use aggregate component at scale
    const allLoans = await ctx.db.query("loans").collect();

    const totalLoans = allLoans.length;
    const closedLoans = allLoans.filter((l) => l.status === "closed").length;
    const deniedLoans = allLoans.filter((l) => l.status === "denied").length;
    const activePipeline = totalLoans - closedLoans - deniedLoans;

    const totalCapital = allLoans.reduce((sum, l) => sum + l.loanAmount, 0);

    // Closed loan revenue: points + interest from closed loans only
    const closedLoanRevenue = allLoans
      .filter((l) => l.status === "closed")
      .reduce((sum, l) => sum + l.pointsEarned + (l.monthlyInterestEarned ?? 0), 0);

    const activeStatuses = [
      "funded",
      "sent_to_title",
    ] as const;
    const activeLoans = allLoans.filter((l) =>
      (activeStatuses as readonly string[]).includes(l.status)
    );
    const monthlyCashFlow = activeLoans.reduce(
      (sum, l) => sum + l.monthlyPayment,
      0
    );

    const pipelineStatuses = [
      "submitted",
      "under_review",
      "additional_info_needed",
      "approved",
      "funded",
      "sent_to_title",
    ] as const;
    const pipelineLoans = allLoans.filter((l) =>
      (pipelineStatuses as readonly string[]).includes(l.status)
    );
    const pipelineValue = pipelineLoans.reduce(
      (sum, l) => sum + l.loanAmount,
      0
    );

    // Status distribution for charts (eliminates need for separate getLoans call)
    const statusCounts: Record<string, number> = {};
    for (const loan of allLoans) {
      statusCounts[loan.status] = (statusCounts[loan.status] || 0) + 1;
    }

    // Monthly volume by close date
    const monthlyVolume: Record<string, number> = {};
    for (const loan of allLoans) {
      if (loan.closeDate) {
        const parts = loan.closeDate.split("/");
        if (parts.length >= 3) {
          const monthKey = `${parts[0]}/${parts[2]}`;
          monthlyVolume[monthKey] = (monthlyVolume[monthKey] || 0) + 1;
        }
      }
    }

    // Recent loans (last 10 by creation time)
    const recentLoans = [...allLoans]
      .sort((a, b) => b._creationTime - a._creationTime)
      .slice(0, 10);

    return {
      totalLoans,
      activePipeline,
      closedLoans,
      deniedLoans,
      totalCapital,
      closedLoanRevenue,
      monthlyCashFlow,
      pipelineValue,
      statusCounts,
      monthlyVolume,
      recentLoans,
    };
  },
});

export const getLoans = query({
  args: {
    statusFilter: v.optional(loanStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.statusFilter) {
      return await ctx.db
        .query("loans")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
        .collect();
    }

    return await ctx.db.query("loans").collect();
  },
});

export const getLoan = query({
  args: { id: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const loan = await ctx.db.get(args.id);
    if (!loan) throw new Error("Loan not found");
    return loan;
  },
});

export const createLoan = mutation({
  args: {
    borrowerId: v.id("userProfiles"),
    borrowerName: v.string(),
    entityName: v.string(),
    propertyAddress: v.string(),
    purchasePrice: v.number(),
    loanAmount: v.number(),
    afterRepairValue: v.optional(v.number()),
    rehabBudgetTotal: v.optional(v.number()),
    closeDate: v.optional(v.string()),
    maturityDate: v.optional(v.string()),
    terms: v.string(),
    interestRate: v.number(),
    monthlyPayment: v.number(),
    paymentDueDay: v.optional(v.number()),
    pointsEarned: v.number(),
    monthlyInterestEarned: v.optional(v.number()),
    status: loanStatusValidator,
    titleCompany: v.optional(v.string()),
    titleCompanyContact: v.optional(v.string()),
    drawFundsTotal: v.optional(v.number()),
    drawFundsUsed: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate borrower exists and has borrower role
    const borrower = await ctx.db.get(args.borrowerId);
    if (!borrower) throw new Error("Borrower not found");
    if (borrower.role !== "borrower") throw new Error("User is not a borrower");

    // Validate financial fields
    if (args.loanAmount <= 0) throw new Error("Loan amount must be greater than 0");
    if (args.purchasePrice < 0) throw new Error("Purchase price cannot be negative");
    if (args.interestRate < 0) throw new Error("Interest rate cannot be negative");
    if (args.monthlyPayment < 0) throw new Error("Monthly payment cannot be negative");
    if (args.pointsEarned < 0) throw new Error("Points earned cannot be negative");
    if (args.paymentDueDay !== undefined && (args.paymentDueDay < 1 || args.paymentDueDay > 31)) {
      throw new Error("Payment due day must be between 1 and 31");
    }
    if (args.afterRepairValue !== undefined && args.afterRepairValue < 0)
      throw new Error("After repair value cannot be negative");
    if (args.rehabBudgetTotal !== undefined && args.rehabBudgetTotal < 0)
      throw new Error("Rehab budget total cannot be negative");
    if (args.drawFundsTotal !== undefined && args.drawFundsTotal < 0)
      throw new Error("Draw funds total cannot be negative");
    if (args.drawFundsUsed !== undefined && args.drawFundsUsed < 0)
      throw new Error("Draw funds used cannot be negative");
    if (args.monthlyInterestEarned !== undefined && args.monthlyInterestEarned < 0)
      throw new Error("Monthly interest earned cannot be negative");

    // Cross-field validation
    if (args.loanAmount > args.purchasePrice) {
      throw new Error("Loan amount cannot exceed purchase price");
    }
    if (args.drawFundsUsed !== undefined && args.drawFundsTotal !== undefined && args.drawFundsUsed > args.drawFundsTotal) {
      throw new Error("Draw funds used cannot exceed draw funds total");
    }
    if (args.afterRepairValue !== undefined && args.afterRepairValue < args.purchasePrice) {
      throw new Error("After repair value should not be less than purchase price");
    }

    const id = await ctx.db.insert("loans", {
      ...args,
      createdBy: admin._id,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.create",
      entityType: "loan",
      entityId: id,
      details: `Created loan for ${args.propertyAddress} (${formatCurrencyPlain(args.loanAmount)})`,
    });

    return id;
  },
});

export const updateLoan = mutation({
  args: {
    id: v.id("loans"),
    borrowerName: v.optional(v.string()),
    entityName: v.optional(v.string()),
    propertyAddress: v.optional(v.string()),
    purchasePrice: v.optional(v.number()),
    loanAmount: v.optional(v.number()),
    afterRepairValue: v.optional(v.number()),
    rehabBudgetTotal: v.optional(v.number()),
    closeDate: v.optional(v.string()),
    maturityDate: v.optional(v.string()),
    terms: v.optional(v.string()),
    interestRate: v.optional(v.number()),
    monthlyPayment: v.optional(v.number()),
    paymentDueDay: v.optional(v.number()),
    pointsEarned: v.optional(v.number()),
    monthlyInterestEarned: v.optional(v.number()),
    titleCompany: v.optional(v.string()),
    titleCompanyContact: v.optional(v.string()),
    drawFundsTotal: v.optional(v.number()),
    drawFundsUsed: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Loan not found");

    // Validate financial fields if provided
    if (fields.loanAmount !== undefined && fields.loanAmount <= 0)
      throw new Error("Loan amount must be greater than 0");
    if (fields.purchasePrice !== undefined && fields.purchasePrice < 0)
      throw new Error("Purchase price cannot be negative");
    if (fields.interestRate !== undefined && fields.interestRate < 0)
      throw new Error("Interest rate cannot be negative");
    if (fields.monthlyPayment !== undefined && fields.monthlyPayment < 0)
      throw new Error("Monthly payment cannot be negative");
    if (fields.pointsEarned !== undefined && fields.pointsEarned < 0)
      throw new Error("Points earned cannot be negative");
    if (fields.paymentDueDay !== undefined && (fields.paymentDueDay < 1 || fields.paymentDueDay > 31))
      throw new Error("Payment due day must be between 1 and 31");
    if (fields.afterRepairValue !== undefined && fields.afterRepairValue < 0)
      throw new Error("After repair value cannot be negative");
    if (fields.rehabBudgetTotal !== undefined && fields.rehabBudgetTotal < 0)
      throw new Error("Rehab budget total cannot be negative");
    if (fields.drawFundsTotal !== undefined && fields.drawFundsTotal < 0)
      throw new Error("Draw funds total cannot be negative");
    if (fields.drawFundsUsed !== undefined && fields.drawFundsUsed < 0)
      throw new Error("Draw funds used cannot be negative");
    if (fields.monthlyInterestEarned !== undefined && fields.monthlyInterestEarned < 0)
      throw new Error("Monthly interest earned cannot be negative");

    // Cross-field validation (use provided values or fall back to existing)
    const effectiveLoanAmount = fields.loanAmount ?? existing.loanAmount;
    const effectivePurchasePrice = fields.purchasePrice ?? existing.purchasePrice;
    const effectiveDrawFundsUsed = fields.drawFundsUsed ?? existing.drawFundsUsed;
    const effectiveDrawFundsTotal = fields.drawFundsTotal ?? existing.drawFundsTotal;
    const effectiveARV = fields.afterRepairValue ?? existing.afterRepairValue;

    if (effectiveLoanAmount > effectivePurchasePrice) {
      throw new Error("Loan amount cannot exceed purchase price");
    }
    if (effectiveDrawFundsUsed !== undefined && effectiveDrawFundsTotal !== undefined && effectiveDrawFundsUsed > effectiveDrawFundsTotal) {
      throw new Error("Draw funds used cannot exceed draw funds total");
    }
    if (effectiveARV !== undefined && effectiveARV < effectivePurchasePrice) {
      throw new Error("After repair value should not be less than purchase price");
    }

    // Only patch fields that were provided (treat empty strings as undefined for optional fields)
    const optionalStringFields = new Set([
      "closeDate", "maturityDate", "titleCompany", "titleCompanyContact", "notes",
    ]);
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        if (optionalStringFields.has(key) && value === "") continue;
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.update",
      entityType: "loan",
      entityId: id,
      details: `Updated loan for ${existing.propertyAddress}`,
    });

    return id;
  },
});

export const getApplications = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const submitted = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "submitted"))
      .collect();
    const underReview = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "under_review"))
      .collect();
    const infoNeeded = await ctx.db
      .query("loans")
      .withIndex("by_status", (q) => q.eq("status", "additional_info_needed"))
      .collect();

    return [...submitted, ...underReview, ...infoNeeded].sort(
      (a, b) => b._creationTime - a._creationTime
    );
  },
});

export const getBorrowerDetail = query({
  args: { id: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const profile = await ctx.db.get(args.id);
    if (!profile) throw new Error("Borrower not found");

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.id))
      .collect();

    const draws = await ctx.db
      .query("drawRequests")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.id))
      .collect();

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.id))
      .collect();

    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
      }))
    );

    // Enrich draws with loan info
    const drawsEnriched = await Promise.all(
      draws.map(async (draw) => {
        const loan = await ctx.db.get(draw.loanId);
        return {
          ...draw,
          propertyAddress: loan?.propertyAddress ?? "Unknown",
        };
      })
    );

    return {
      profile,
      loans,
      draws: drawsEnriched,
      documents: docsWithUrls,
    };
  },
});

const VALID_TRANSITIONS: Record<string, string[]> = {
  submitted: ["under_review", "additional_info_needed", "denied"],
  under_review: ["approved", "additional_info_needed", "denied"],
  additional_info_needed: ["under_review", "denied"],
  approved: ["funded", "denied"],
  funded: ["sent_to_title", "closed"],
  sent_to_title: ["closed"],
  denied: [],
  closed: [],
};

export const updateLoanStatus = mutation({
  args: {
    id: v.id("loans"),
    status: loanStatusValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Loan not found");

    const validNext = VALID_TRANSITIONS[existing.status];
    if (!validNext || !validNext.includes(args.status)) {
      throw new Error(
        `Invalid status transition: cannot move from "${existing.status}" to "${args.status}"`
      );
    }

    await ctx.db.patch(args.id, { status: args.status });

    // Notify borrower of status change
    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: existing.borrowerId,
      type: "loan_status_changed",
      title: "Loan Status Updated",
      body: `Your loan for ${existing.propertyAddress} has been updated to "${LOAN_STATUS_LABELS[args.status] ?? args.status}".`,
      loanId: args.id,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.status",
      entityType: "loan",
      entityId: args.id,
      details: `Changed status from "${existing.status}" to "${args.status}" for ${existing.propertyAddress}`,
    });

    return args.id;
  },
});

// --- Closing Statement ---

export const attachClosingStatement = mutation({
  args: {
    loanId: v.id("loans"),
    fileId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    // Delete old file from storage to prevent orphans
    if (loan.closingStatementFileId) {
      await ctx.storage.delete(loan.closingStatementFileId);
    }
    await ctx.db.patch(args.loanId, { closingStatementFileId: args.fileId });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.attachClosing",
      entityType: "loan",
      entityId: args.loanId,
      details: `Attached closing statement to ${loan.propertyAddress}`,
    });

    return args.loanId;
  },
});

export const removeClosingStatement = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    if (loan.closingStatementFileId) {
      await ctx.storage.delete(loan.closingStatementFileId);
      await ctx.db.patch(args.loanId, { closingStatementFileId: undefined });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.removeClosing",
      entityType: "loan",
      entityId: args.loanId,
      details: `Removed closing statement from ${loan.propertyAddress}`,
    });

    return args.loanId;
  },
});

export const getClosingStatementUrl = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan || !loan.closingStatementFileId) return null;
    return await ctx.storage.getUrl(loan.closingStatementFileId);
  },
});

// --- Borrower Performance ---

export const getBorrowerPerformance = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const borrowers = await ctx.db
      .query("userProfiles")
      .withIndex("by_role", (q) => q.eq("role", "borrower"))
      .collect();

    // Batch-load all loans and payments once instead of N+1
    // TODO(scale): Unbounded .collect() — paginate or use aggregate component at scale
    const allLoans = await ctx.db.query("loans").collect();
    // TODO(scale): Unbounded .collect() — paginate or use aggregate component at scale
    const allPayments = await ctx.db.query("loanPayments").collect();

    // Group loans by borrowerId
    const loansByBorrower = new Map<string, typeof allLoans>();
    for (const loan of allLoans) {
      const existing = loansByBorrower.get(loan.borrowerId) ?? [];
      existing.push(loan);
      loansByBorrower.set(loan.borrowerId, existing);
    }

    // Group payments by loanId
    const paymentsByLoan = new Map<string, typeof allPayments>();
    for (const payment of allPayments) {
      const existing = paymentsByLoan.get(payment.loanId) ?? [];
      existing.push(payment);
      paymentsByLoan.set(payment.loanId, existing);
    }

    const results = borrowers.map((borrower) => {
      const loans = loansByBorrower.get(borrower._id) ?? [];
      const totalCapital = loans.reduce((sum, l) => sum + l.loanAmount, 0);

      let totalPayments = 0;
      let onTimePayments = 0;
      let latePayments = 0;
      for (const loan of loans) {
        const payments = paymentsByLoan.get(loan._id) ?? [];
        totalPayments += payments.length;
        onTimePayments += payments.filter((p) => p.status === "on_time").length;
        latePayments += payments.filter((p) => p.status === "late" || p.status === "missed").length;
      }

      return {
        _id: borrower._id,
        displayName: borrower.displayName,
        totalLoans: loans.length,
        totalCapital,
        totalPayments,
        latePayments,
        onTimeRate: totalPayments > 0
          ? Math.round((onTimePayments / totalPayments) * 100)
          : null,
      };
    });

    return results.filter((r) => r.totalLoans > 0);
  },
});

// --- Rehab Budget Items ---

export const getRehabBudgetItems = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("rehabBudgetItems")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();
  },
});

// Keep in sync with REHAB_CATEGORIES in convex/lib/constants.ts
const rehabCategoryValidator = v.union(
  v.literal("demo"),
  v.literal("exterior"),
  v.literal("interior"),
  v.literal("dumpster"),
  v.literal("miscellaneous"),
  v.literal("overage")
);

export const addRehabBudgetItem = mutation({
  args: {
    loanId: v.id("loans"),
    category: rehabCategoryValidator,
    itemName: v.string(),
    allocatedAmount: v.number(),
    actualAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");
    const trimmedName = args.itemName.trim();
    if (!trimmedName) throw new Error("Item name is required");
    if (args.allocatedAmount <= 0) throw new Error("Allocated amount must be greater than 0");
    if (args.actualAmount !== undefined && args.actualAmount < 0) throw new Error("Actual amount cannot be negative");
    const id = await ctx.db.insert("rehabBudgetItems", { ...args, itemName: trimmedName });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "rehab.addItem",
      entityType: "loan",
      entityId: args.loanId,
      details: `Added rehab item "${trimmedName}" (${formatCurrencyPlain(args.allocatedAmount)}) to ${loan.propertyAddress}`,
    });

    return id;
  },
});

export const updateRehabBudgetItem = mutation({
  args: {
    id: v.id("rehabBudgetItems"),
    category: v.optional(rehabCategoryValidator),
    itemName: v.optional(v.string()),
    allocatedAmount: v.optional(v.number()),
    actualAmount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Budget item not found");

    if (fields.itemName !== undefined) {
      const trimmed = fields.itemName.trim();
      if (!trimmed) throw new Error("Item name is required");
      fields.itemName = trimmed;
    }
    if (fields.allocatedAmount !== undefined && fields.allocatedAmount <= 0)
      throw new Error("Allocated amount must be greater than 0");
    if (fields.actualAmount !== undefined && fields.actualAmount < 0)
      throw new Error("Actual amount cannot be negative");

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "rehab.updateItem",
      entityType: "loan",
      entityId: existing.loanId,
      details: `Updated rehab item "${existing.itemName}"`,
    });

    return id;
  },
});

export const deleteRehabBudgetItem = mutation({
  args: { id: v.id("rehabBudgetItems") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Budget item not found");
    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "rehab.deleteItem",
      entityType: "loan",
      entityId: existing.loanId,
      details: `Deleted rehab item "${existing.itemName}"`,
    });
  },
});

// --- Investments ---

export const createInvestment = mutation({
  args: {
    investorId: v.id("userProfiles"),
    investmentAmount: v.number(),
    inceptionDate: v.number(),
    interestRate: v.number(),
    totalPaymentsReceived: v.number(),
    nextPaymentDate: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const investor = await ctx.db.get(args.investorId);
    if (!investor) throw new Error("Investor not found");
    if (investor.role !== "investor")
      throw new Error("User is not an investor");
    if (!investor.isActive)
      throw new Error("Cannot create investments for deactivated investors");

    // Validate financial fields
    if (args.investmentAmount <= 0) throw new Error("Investment amount must be greater than 0");
    if (args.interestRate < 0) throw new Error("Interest rate cannot be negative");
    if (args.totalPaymentsReceived < 0) throw new Error("Total payments received cannot be negative");
    if (isNaN(args.inceptionDate)) throw new Error("Invalid inception date");
    if (isNaN(args.nextPaymentDate)) throw new Error("Invalid next payment date");
    if (args.nextPaymentDate <= args.inceptionDate) {
      throw new Error("Next payment date must be after inception date");
    }

    const id = await ctx.db.insert("investments", args);

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "investment.create",
      entityType: "investment",
      entityId: id,
      details: `Created investment of ${formatCurrencyPlain(args.investmentAmount)} for ${investor!.displayName}`,
    });

    return id;
  },
});

export const updateInvestment = mutation({
  args: {
    id: v.id("investments"),
    investmentAmount: v.optional(v.number()),
    interestRate: v.optional(v.number()),
    totalPaymentsReceived: v.optional(v.number()),
    nextPaymentDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Investment not found");

    // Validate financial fields if provided
    if (fields.investmentAmount !== undefined && fields.investmentAmount <= 0)
      throw new Error("Investment amount must be greater than 0");
    if (fields.interestRate !== undefined && fields.interestRate < 0)
      throw new Error("Interest rate cannot be negative");
    if (fields.totalPaymentsReceived !== undefined && fields.totalPaymentsReceived < 0)
      throw new Error("Total payments received cannot be negative");
    if (fields.nextPaymentDate !== undefined && isNaN(fields.nextPaymentDate))
      throw new Error("Invalid next payment date");

    // Cross-field date validation
    if (fields.nextPaymentDate !== undefined) {
      const effectiveInceptionDate = existing.inceptionDate;
      if (fields.nextPaymentDate <= effectiveInceptionDate) {
        throw new Error("Next payment date must be after inception date");
      }
    }

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        updates[key] = value;
      }
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "investment.update",
      entityType: "investment",
      entityId: id,
      details: `Updated investment (${formatCurrencyPlain(existing.investmentAmount)})`,
    });

    return id;
  },
});

export const deleteInvestment = mutation({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Investment not found");
    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "investment.delete",
      entityType: "investment",
      entityId: args.id,
      details: `Deleted investment of ${formatCurrencyPlain(existing.investmentAmount)}`,
    });
  },
});

export const bulkUpdateLoanStatus = mutation({
  args: {
    loanIds: v.array(v.id("loans")),
    status: loanStatusValidator,
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (args.loanIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }

    const results: { loanId: string; success: boolean; error?: string }[] = [];

    for (const loanId of args.loanIds) {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        results.push({ loanId, success: false, error: "Loan not found" });
        continue;
      }

      const validNext = VALID_TRANSITIONS[loan.status];
      if (!validNext || !validNext.includes(args.status)) {
        results.push({ loanId, success: false, error: `Cannot transition from "${loan.status}" to "${args.status}"` });
        continue;
      }

      await ctx.db.patch(loanId, { status: args.status });

      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: loan.borrowerId,
        type: "loan_status_changed",
        title: "Loan Status Updated",
        body: `Your loan for ${loan.propertyAddress} has been updated to "${LOAN_STATUS_LABELS[args.status] ?? args.status}".`,
        loanId,
      });

      results.push({ loanId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.bulkStatus",
      entityType: "loan",
      details: `Bulk updated ${successCount}/${args.loanIds.length} loans to "${args.status}"`,
    });

    return results;
  },
});

export const getInvestorDetail = query({
  args: { id: v.id("userProfiles") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get(args.id);
    if (!profile) throw new Error("Investor not found");
    if (profile.role !== "investor") throw new Error("User is not an investor");

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_investorId", (q) => q.eq("investorId", args.id))
      .collect();

    return { profile, investments };
  },
});
