import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";
import {
  DEFAULT_POINTS_PERCENTAGE,
  MAX_BULK_OPERATION_SIZE,
  LOAN_STATUS_LABELS,
  formatCurrencyPlain,
  isActiveLoanStatus,
  isFundedLoanStatus,
  isPipelineLoanStatus,
  isPreFundingLoanStatus,
} from "./lib/constants";
import { parseUsDate, validateUsDate } from "./lib/dates";
import { calculateMonthlyInterest, getCurrentPrincipalOut } from "./lib/loanCalculations";
import { getDefaultInterestRate } from "./lib/settings";

const strategyValidator = v.union(v.literal("flip_and_resell"), v.literal("brrrr"));

// Keep in sync with REHAB_CATEGORIES in convex/lib/constants.ts
const rehabCategoryValidator = v.union(
  v.literal("demo"),
  v.literal("exterior"),
  v.literal("interior"),
  v.literal("dumpster"),
  v.literal("miscellaneous"),
  v.literal("overage")
);

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

function titleContactKey(titleCompany: string, titleCompanyContact: string | undefined) {
  return `${titleCompany.trim().toLowerCase()}::${(titleCompanyContact ?? "").trim().toLowerCase()}`;
}

function getTotalLoanAmount(purchasePrice: number, rehabBudgetTotal: number | undefined) {
  return purchasePrice + (rehabBudgetTotal ?? 0);
}

function getPointsEarned(totalLoanAmount: number) {
  return Math.round((DEFAULT_POINTS_PERCENTAGE / 100) * totalLoanAmount * 100) / 100;
}

async function saveBorrowerTitleContact(
  ctx: MutationCtx,
  borrowerId: Id<"userProfiles">,
  titleCompany: string | undefined,
  titleCompanyContact: string | undefined
) {
  const company = titleCompany?.trim();
  if (!company) return;

  const contact = titleCompanyContact?.trim() || undefined;
  const normalizedKey = titleContactKey(company, contact);
  const existing = await ctx.db
    .query("borrowerTitleContacts")
    .withIndex("by_borrowerId_and_normalizedKey", (q) =>
      q.eq("borrowerId", borrowerId).eq("normalizedKey", normalizedKey)
    )
    .take(1);

  if (existing[0]) {
    await ctx.db.patch(existing[0]._id, {
      titleCompany: company,
      titleCompanyContact: contact,
      updatedAt: Date.now(),
    });
    return;
  }

  await ctx.db.insert("borrowerTitleContacts", {
    borrowerId,
    titleCompany: company,
    titleCompanyContact: contact,
    normalizedKey,
    updatedAt: Date.now(),
  });
}

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

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const defaultInterestRate = await getDefaultInterestRate(ctx);
    const activeLoans = allLoans.filter((loan) => {
      if (loan.returnedDate) return false;
      if ((loan.paymentType ?? "monthly") === "balloon") return false;
      if (loan.status === "funded" || loan.status === "sent_to_title") return true;

      if (loan.status === "closed") {
        const maturity = parseUsDate(loan.maturityDate ?? "");
        return maturity !== null && maturity >= today;
      }

      return false;
    });
    const activeCashFlow = activeLoans.map((loan) => {
      const principalOut = getCurrentPrincipalOut(loan);
      return {
        principalOut,
        drawRemaining: Math.max(0, (loan.drawFundsTotal ?? 0) - (loan.drawFundsUsed ?? 0)),
        monthlyCashFlow: calculateMonthlyInterest(principalOut, defaultInterestRate),
      };
    });
    const monthlyCashFlow = Math.round(activeCashFlow.reduce((sum, l) => sum + l.monthlyCashFlow, 0) * 100) / 100;
    const totalPrincipalOut = Math.round(activeCashFlow.reduce((sum, l) => sum + l.principalOut, 0) * 100) / 100;
    const totalDrawRemaining = Math.round(activeCashFlow.reduce((sum, l) => sum + l.drawRemaining, 0) * 100) / 100;

    const pipelineLoans = allLoans.filter((l) => isPipelineLoanStatus(l.status) && !l.returnedDate);
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
      cashFlowInterestRate: defaultInterestRate,
      totalPrincipalOut,
      totalDrawRemaining,
      pipelineValue,
      statusCounts,
      monthlyVolume,
      recentLoans,
    };
  },
});

export const getLoanPeriodKpis = query({
  args: {
    year: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    if (args.year !== undefined && (!Number.isInteger(args.year) || args.year < 1900 || args.year > 3000)) {
      throw new ConvexError("Year must be a valid four-digit year");
    }

    const allLoans = await ctx.db.query("loans").collect();
    const years = new Set<number>();
    const loansWithCloseDate: { loan: (typeof allLoans)[number]; closeDate: Date }[] = [];

    for (const loan of allLoans) {
      if (!loan.closeDate) continue;
      const closeDate = parseUsDate(loan.closeDate);
      if (!closeDate) continue;
      years.add(closeDate.getFullYear());
      loansWithCloseDate.push({ loan, closeDate });
    }

    const availableYears = [...years].sort((a, b) => b - a);
    const selectedYear = args.year ?? availableYears[0] ?? new Date().getFullYear();

    const periods = [
      { key: "q1", label: "Q1", startMonth: 1, endMonth: 3 },
      { key: "q2", label: "Q2", startMonth: 4, endMonth: 6 },
      { key: "q3", label: "Q3", startMonth: 7, endMonth: 9 },
      { key: "q4", label: "Q4", startMonth: 10, endMonth: 12 },
      { key: "full-year", label: "Full Year", startMonth: 1, endMonth: 12 },
    ].map((period) => ({
      ...period,
      totalLoans: 0,
      activeLoans: 0,
      inProgressLoans: 0,
      fundedLoans: 0,
      totalCapital: 0,
    }));

    const addLoanToPeriod = (period: (typeof periods)[number], loan: (typeof allLoans)[number]) => {
      period.totalLoans += 1;
      period.totalCapital += loan.loanAmount;
      if (isActiveLoanStatus(loan.status) && !loan.returnedDate) {
        period.activeLoans += 1;
      }
      if (isPreFundingLoanStatus(loan.status)) {
        period.inProgressLoans += 1;
      }
      if (isFundedLoanStatus(loan.status)) {
        period.fundedLoans += 1;
      }
    };

    for (const { loan, closeDate } of loansWithCloseDate) {
      if (closeDate.getFullYear() !== selectedYear) continue;

      const month = closeDate.getMonth() + 1;
      const quarter = periods.find(
        (period) => period.key !== "full-year" && month >= period.startMonth && month <= period.endMonth
      );
      const fullYear = periods[4];

      if (quarter) addLoanToPeriod(quarter, loan);
      addLoanToPeriod(fullYear, loan);
    }

    return {
      selectedYear,
      availableYears,
      periods,
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
    if (!loan) throw new ConvexError("Loan not found");
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
    strategy: v.optional(strategyValidator),
    paymentType: v.optional(v.union(v.literal("balloon"), v.literal("monthly"))),
    drawFundsTotal: v.optional(v.number()),
    drawFundsUsed: v.optional(v.number()),
    notes: v.optional(v.string()),
    rehabBudgetItems: v.optional(v.array(v.object({
      category: rehabCategoryValidator,
      itemName: v.string(),
      allocatedAmount: v.number(),
    }))),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    // Validate borrower exists and has borrower role
    const borrower = await ctx.db.get(args.borrowerId);
    if (!borrower) throw new ConvexError("Borrower not found");
    if (borrower.role !== "borrower") throw new ConvexError("User is not a borrower");

    // Trim string inputs
    const borrowerName = args.borrowerName.trim();
    const entityName = args.entityName.trim();
    const propertyAddress = args.propertyAddress.trim();
    const terms = args.terms.trim();
    const titleCompany = args.titleCompany?.trim() || undefined;
    const titleCompanyContact = args.titleCompanyContact?.trim() || undefined;
    const notes = args.notes?.trim() || undefined;
    const closeDate = args.closeDate?.trim() || undefined;
    const maturityDate = args.maturityDate?.trim() || undefined;

    if (closeDate) validateUsDate(closeDate, "Close date");
    if (maturityDate) validateUsDate(maturityDate, "Maturity date", { allowFuture: true });

    if (!borrowerName) throw new ConvexError("Borrower name cannot be empty");
    if (!entityName) throw new ConvexError("Entity name cannot be empty");
    if (!propertyAddress) throw new ConvexError("Property address cannot be empty");
    if (!terms) throw new ConvexError("Terms cannot be empty");

    const canonicalLoanAmount = getTotalLoanAmount(args.purchasePrice, args.rehabBudgetTotal);
    const canonicalPointsEarned = getPointsEarned(canonicalLoanAmount);

    // Validate financial fields
    if (canonicalLoanAmount <= 0) throw new ConvexError("Total loan amount must be greater than 0");
    if (args.purchasePrice < 0) throw new ConvexError("Purchase price cannot be negative");
    if (args.interestRate < 0) throw new ConvexError("Interest rate cannot be negative");
    if (args.monthlyPayment < 0) throw new ConvexError("Monthly payment cannot be negative");
    if (args.pointsEarned < 0) throw new ConvexError("Points earned cannot be negative");
    if (args.paymentDueDay !== undefined && (args.paymentDueDay < 1 || args.paymentDueDay > 31)) {
      throw new ConvexError("Payment due day must be between 1 and 31");
    }
    if (args.afterRepairValue !== undefined && args.afterRepairValue < 0)
      throw new ConvexError("After repair value cannot be negative");
    if (args.rehabBudgetTotal !== undefined && args.rehabBudgetTotal < 0)
      throw new ConvexError("Rehab budget total cannot be negative");
    if (args.drawFundsTotal !== undefined && args.drawFundsTotal < 0)
      throw new ConvexError("Draw funds total cannot be negative");
    if (args.drawFundsUsed !== undefined && args.drawFundsUsed < 0)
      throw new ConvexError("Draw funds used cannot be negative");
    if (args.monthlyInterestEarned !== undefined && args.monthlyInterestEarned < 0)
      throw new ConvexError("Monthly interest earned cannot be negative");

    // Cross-field validation
    if (args.drawFundsUsed !== undefined && args.drawFundsTotal !== undefined && args.drawFundsUsed > args.drawFundsTotal) {
      throw new ConvexError("Draw funds used cannot exceed draw funds total");
    }
    if (args.afterRepairValue !== undefined && args.afterRepairValue < args.purchasePrice) {
      throw new ConvexError("After repair value should not be less than purchase price");
    }

    const { rehabBudgetItems, ...loanFields } = args;
    const monthlyPayment = calculateMonthlyInterest(
      getCurrentPrincipalOut({
        loanAmount: canonicalLoanAmount,
        drawFundsTotal: args.drawFundsTotal,
        drawFundsUsed: args.drawFundsUsed,
      }),
      args.interestRate
    );

    const id = await ctx.db.insert("loans", {
      ...loanFields,
      loanAmount: canonicalLoanAmount,
      monthlyPayment,
      pointsEarned: canonicalPointsEarned,
      borrowerName,
      entityName,
      propertyAddress,
      terms,
      titleCompany,
      titleCompanyContact,
      notes,
      closeDate,
      maturityDate,
      paymentType: args.paymentType ?? "monthly",
      createdBy: admin._id,
    });

    // Create rehab budget items if provided
    if (rehabBudgetItems && rehabBudgetItems.length > 0) {
      for (const item of rehabBudgetItems) {
        const itemName = item.itemName.trim();
        if (!itemName) throw new ConvexError("Rehab budget item name cannot be empty");
        if (item.allocatedAmount <= 0) throw new ConvexError("Rehab budget allocated amount must be greater than 0");
        await ctx.db.insert("rehabBudgetItems", {
          loanId: id,
          category: item.category,
          itemName,
          allocatedAmount: item.allocatedAmount,
        });
      }
    }

    await saveBorrowerTitleContact(ctx, args.borrowerId, titleCompany, titleCompanyContact);

    if (closeDate) {
      await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
        loanId: id,
        createdBy: admin._id,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.create",
      entityType: "loan",
      entityId: id,
      details: `Created loan for ${propertyAddress} (${formatCurrencyPlain(canonicalLoanAmount)})`,
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
    strategy: v.optional(strategyValidator),
    paymentType: v.optional(v.union(v.literal("balloon"), v.literal("monthly"))),
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
    if (!existing) throw new ConvexError("Loan not found");

    // Validate financial fields if provided
    if (fields.purchasePrice !== undefined && fields.purchasePrice < 0)
      throw new ConvexError("Purchase price cannot be negative");
    if (fields.interestRate !== undefined && fields.interestRate < 0)
      throw new ConvexError("Interest rate cannot be negative");
    if (fields.monthlyPayment !== undefined && fields.monthlyPayment < 0)
      throw new ConvexError("Monthly payment cannot be negative");
    if (fields.pointsEarned !== undefined && fields.pointsEarned < 0)
      throw new ConvexError("Points earned cannot be negative");
    if (fields.paymentDueDay !== undefined && (fields.paymentDueDay < 1 || fields.paymentDueDay > 31))
      throw new ConvexError("Payment due day must be between 1 and 31");
    if (fields.afterRepairValue !== undefined && fields.afterRepairValue < 0)
      throw new ConvexError("After repair value cannot be negative");
    if (fields.rehabBudgetTotal !== undefined && fields.rehabBudgetTotal < 0)
      throw new ConvexError("Rehab budget total cannot be negative");
    if (fields.drawFundsTotal !== undefined && fields.drawFundsTotal < 0)
      throw new ConvexError("Draw funds total cannot be negative");
    if (fields.drawFundsUsed !== undefined && fields.drawFundsUsed < 0)
      throw new ConvexError("Draw funds used cannot be negative");
    if (fields.monthlyInterestEarned !== undefined && fields.monthlyInterestEarned < 0)
      throw new ConvexError("Monthly interest earned cannot be negative");

    // Cross-field validation (use provided values or fall back to existing)
    const effectivePurchasePrice = fields.purchasePrice ?? existing.purchasePrice;
    const effectiveRehabBudgetTotal = fields.rehabBudgetTotal ?? existing.rehabBudgetTotal;
    const effectiveLoanAmount = getTotalLoanAmount(effectivePurchasePrice, effectiveRehabBudgetTotal);
    const effectiveDrawFundsUsed = fields.drawFundsUsed ?? existing.drawFundsUsed;
    const effectiveDrawFundsTotal = fields.drawFundsTotal ?? existing.drawFundsTotal;
    const effectiveARV = fields.afterRepairValue ?? existing.afterRepairValue;
    const effectiveInterestRate = fields.interestRate ?? existing.interestRate;

    if (effectiveLoanAmount <= 0) {
      throw new ConvexError("Total loan amount must be greater than 0");
    }

    if (effectiveDrawFundsUsed !== undefined && effectiveDrawFundsTotal !== undefined && effectiveDrawFundsUsed > effectiveDrawFundsTotal) {
      throw new ConvexError("Draw funds used cannot exceed draw funds total");
    }
    if (effectiveARV !== undefined && effectiveARV < effectivePurchasePrice) {
      throw new ConvexError("After repair value should not be less than purchase price");
    }

    // Trim string fields and validate required ones
    const requiredStringFields = new Set([
      "borrowerName", "entityName", "propertyAddress", "terms",
    ]);
    const optionalStringFields = new Set([
      "closeDate", "maturityDate", "titleCompany", "titleCompanyContact", "notes",
    ]);
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        if (typeof value === "string") {
          const trimmed = value.trim();
          if (requiredStringFields.has(key)) {
            if (!trimmed) throw new ConvexError(`${key} cannot be empty`);
            updates[key] = trimmed;
          } else if (optionalStringFields.has(key)) {
            if (!trimmed) continue; // skip empty optional strings
            if (key === "closeDate") validateUsDate(trimmed, "Close date");
            if (key === "maturityDate") validateUsDate(trimmed, "Maturity date", { allowFuture: true });
            updates[key] = trimmed;
          } else {
            updates[key] = value;
          }
        } else {
          updates[key] = value;
        }
      }
    }

    if (
      fields.purchasePrice !== undefined ||
      fields.rehabBudgetTotal !== undefined ||
      fields.loanAmount !== undefined ||
      fields.pointsEarned !== undefined
    ) {
      updates.loanAmount = effectiveLoanAmount;
      updates.pointsEarned = getPointsEarned(effectiveLoanAmount);
    }

    if (
      fields.purchasePrice !== undefined ||
      fields.rehabBudgetTotal !== undefined ||
      fields.loanAmount !== undefined ||
      fields.drawFundsTotal !== undefined ||
      fields.drawFundsUsed !== undefined ||
      fields.interestRate !== undefined ||
      fields.monthlyPayment !== undefined
    ) {
      updates.monthlyPayment = calculateMonthlyInterest(
        getCurrentPrincipalOut({
          loanAmount: effectiveLoanAmount,
          drawFundsTotal: effectiveDrawFundsTotal,
          drawFundsUsed: effectiveDrawFundsUsed,
        }),
        effectiveInterestRate
      );
    }

    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }

    if (fields.titleCompany !== undefined || fields.titleCompanyContact !== undefined) {
      await saveBorrowerTitleContact(
        ctx,
        existing.borrowerId,
        (updates.titleCompany as string | undefined) ?? existing.titleCompany,
        (updates.titleCompanyContact as string | undefined) ?? existing.titleCompanyContact
      );
    }

    if (
      fields.closeDate !== undefined ||
      fields.purchasePrice !== undefined ||
      fields.rehabBudgetTotal !== undefined ||
      fields.drawFundsTotal !== undefined ||
      fields.drawFundsUsed !== undefined ||
      fields.interestRate !== undefined
    ) {
      await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
        loanId: id,
        createdBy: admin._id,
      });
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

async function deleteLoanAndRelatedRecords(ctx: MutationCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  if (!loan) return null;

  const [rehabBudgetItems, drawRequests, loanDocuments, loanPayments, loanCharges, messages, propertyComps, notifications] =
    await Promise.all([
      ctx.db.query("rehabBudgetItems").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("drawRequests").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("documents").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("loanPayments").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("loanCharges").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("messages").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("propertyComps").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
      ctx.db.query("notifications").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).collect(),
    ]);

  const documentsById = new Map(loanDocuments.map((document) => [document._id, document]));
  for (const drawRequest of drawRequests) {
    const [drawDocuments, drawNotifications] = await Promise.all([
      ctx.db
        .query("documents")
        .withIndex("by_drawRequestId", (q) => q.eq("drawRequestId", drawRequest._id))
        .collect(),
      ctx.db
        .query("notifications")
        .withIndex("by_drawRequestId", (q) => q.eq("drawRequestId", drawRequest._id))
        .collect(),
    ]);
    for (const document of drawDocuments) {
      documentsById.set(document._id, document);
    }
    for (const notification of drawNotifications) {
      notifications.push(notification);
    }
  }

  const deletedFileIds = new Set<string>();
  for (const document of documentsById.values()) {
    await ctx.storage.delete(document.fileId);
    deletedFileIds.add(document.fileId);
    await ctx.db.delete(document._id);
  }

  if (loan.closingStatementFileId && !deletedFileIds.has(loan.closingStatementFileId)) {
    await ctx.storage.delete(loan.closingStatementFileId);
  }

  for (const item of rehabBudgetItems) await ctx.db.delete(item._id);
  for (const payment of loanPayments) await ctx.db.delete(payment._id);
  for (const charge of loanCharges) await ctx.db.delete(charge._id);
  for (const message of messages) await ctx.db.delete(message._id);
  for (const comp of propertyComps) await ctx.db.delete(comp._id);
  for (const drawRequest of drawRequests) await ctx.db.delete(drawRequest._id);
  for (const notification of new Map(notifications.map((item) => [item._id, item])).values()) await ctx.db.delete(notification._id);

  const sourcePropertyComps = await ctx.db
    .query("propertyComps")
    .withIndex("by_sourceLoanId", (q) => q.eq("sourceLoanId", loanId))
    .collect();
  for (const comp of sourcePropertyComps) {
    await ctx.db.patch(comp._id, { sourceLoanId: undefined });
  }

  await ctx.db.delete(loanId);
  return loan;
}

export const bulkDeleteLoans = mutation({
  args: {
    loanIds: v.array(v.id("loans")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const uniqueLoanIds = [...new Set(args.loanIds)];

    if (uniqueLoanIds.length === 0) {
      throw new ConvexError("Select at least one loan to delete");
    }

    if (uniqueLoanIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new ConvexError(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }

    let deletedCount = 0;

    for (const loanId of uniqueLoanIds) {
      const deletedLoan = await deleteLoanAndRelatedRecords(ctx, loanId);
      if (deletedLoan) deletedCount++;
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.delete",
      entityType: "loan",
      details: `Deleted ${deletedCount}/${uniqueLoanIds.length} loans`,
      metadata: JSON.stringify({ loanIds: uniqueLoanIds }),
    });

    return {
      requested: uniqueLoanIds.length,
      deleted: deletedCount,
    };
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
    if (!profile) throw new ConvexError("Borrower not found");

    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.id))
      .collect();

    const draws = await ctx.db
      .query("drawRequests")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", args.id))
      .collect();

    const borrowerDocuments = await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", args.id))
      .collect();

    const loanDocuments = (
      await Promise.all(
        loans.map((loan) =>
          ctx.db
            .query("documents")
            .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
            .collect()
        )
      )
    ).flat();

    const documents = Array.from(
      new Map([...borrowerDocuments, ...loanDocuments].map((doc) => [doc._id, doc])).values()
    );

    const loanMap = new Map(loans.map((loan) => [loan._id, loan]));

    const docsWithUrls = await Promise.all(
      documents.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
        propertyAddress: doc.loanId ? loanMap.get(doc.loanId)?.propertyAddress : undefined,
        entityName: doc.loanId ? loanMap.get(doc.loanId)?.entityName : undefined,
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
  submitted: ["under_review", "additional_info_needed", "denied", "closed"],
  under_review: ["approved", "additional_info_needed", "denied", "closed"],
  additional_info_needed: ["under_review", "denied", "closed"],
  approved: ["funded", "denied", "closed"],
  funded: ["sent_to_title", "closed"],
  sent_to_title: ["closed"],
  denied: ["under_review", "approved", "closed"],
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
    if (!existing) throw new ConvexError("Loan not found");
    if (existing.returnedDate && args.status !== "closed") {
      throw new ConvexError("Cannot change status after funds have been marked returned");
    }

    if (existing.status === args.status) {
      return args.id;
    }

    const validNext = VALID_TRANSITIONS[existing.status];
    if (!validNext || !validNext.includes(args.status)) {
      throw new ConvexError(
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
      sendSms: true,
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

export const recordLoanReturned = mutation({
  args: {
    id: v.id("loans"),
    returnedDate: v.string(),
    returnedAmount: v.number(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.id);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.returnedDate) throw new ConvexError("Funds have already been marked returned for this loan");
    if (!["funded", "sent_to_title", "closed"].includes(loan.status)) {
      throw new ConvexError("Funds can only be marked returned for funded, sent to title, or closed loans");
    }

    const returnedDate = args.returnedDate.trim();
    validateUsDate(returnedDate, "Return date");
    if (!Number.isFinite(args.returnedAmount) || args.returnedAmount <= 0) {
      throw new ConvexError("Returned amount must be greater than 0");
    }
    const returnedNotes = args.notes?.trim() || undefined;

    await ctx.db.patch(args.id, {
      status: "closed",
      returnedDate,
      returnedAmount: Math.round(args.returnedAmount * 100) / 100,
      returnedAt: Date.now(),
      returnedBy: admin._id,
      ...(returnedNotes ? { returnedNotes } : {}),
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "loan.returned",
      entityType: "loan",
      entityId: args.id,
      details: `Recorded ${formatCurrencyPlain(args.returnedAmount)} returned for ${loan.propertyAddress} on ${returnedDate}`,
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
    if (!loan) throw new ConvexError("Loan not found");
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
    if (!loan) throw new ConvexError("Loan not found");
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
      const closedLoans = loans.filter((loan) => loan.status === "closed");
      const inProgressLoans = loans.filter((loan) => isPipelineLoanStatus(loan.status));
      const totalCapital = closedLoans.reduce((sum, l) => sum + l.loanAmount, 0);

      let totalPayments = 0;
      let onTimePayments = 0;
      let latePayments = 0;
      for (const loan of closedLoans) {
        const payments = paymentsByLoan.get(loan._id) ?? [];
        totalPayments += payments.length;
        onTimePayments += payments.filter((p) => p.status === "on_time").length;
        latePayments += payments.filter((p) => p.status === "late" || p.status === "missed").length;
      }

      return {
        _id: borrower._id,
        displayName: borrower.displayName,
        totalLoans: closedLoans.length,
        inProgressLoans: inProgressLoans.length,
        totalCapital,
        totalPayments,
        latePayments,
        onTimeRate: totalPayments > 0
          ? Math.round((onTimePayments / totalPayments) * 100)
          : null,
      };
    });

    return results.filter((r) => r.totalLoans > 0 || r.inProgressLoans > 0);
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
    if (!loan) throw new ConvexError("Loan not found");
    const trimmedName = args.itemName.trim();
    if (!trimmedName) throw new ConvexError("Item name is required");
    if (args.allocatedAmount <= 0) throw new ConvexError("Allocated amount must be greater than 0");
    if (args.actualAmount !== undefined && args.actualAmount < 0) throw new ConvexError("Actual amount cannot be negative");
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
    if (!existing) throw new ConvexError("Budget item not found");

    if (fields.itemName !== undefined) {
      const trimmed = fields.itemName.trim();
      if (!trimmed) throw new ConvexError("Item name is required");
      fields.itemName = trimmed;
    }
    if (fields.allocatedAmount !== undefined && fields.allocatedAmount <= 0)
      throw new ConvexError("Allocated amount must be greater than 0");
    if (fields.actualAmount !== undefined && fields.actualAmount < 0)
      throw new ConvexError("Actual amount cannot be negative");

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
    if (!existing) throw new ConvexError("Budget item not found");
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
    if (!investor) throw new ConvexError("Investor not found");
    if (investor.role !== "investor")
      throw new ConvexError("User is not an investor");
    if (!investor.isActive)
      throw new ConvexError("Cannot create investments for deactivated investors");

    // Validate financial fields
    if (args.investmentAmount <= 0) throw new ConvexError("Investment amount must be greater than 0");
    if (args.interestRate < 0) throw new ConvexError("Interest rate cannot be negative");
    if (args.totalPaymentsReceived < 0) throw new ConvexError("Total payments received cannot be negative");
    if (isNaN(args.inceptionDate)) throw new ConvexError("Invalid inception date");
    if (isNaN(args.nextPaymentDate)) throw new ConvexError("Invalid next payment date");
    if (args.nextPaymentDate <= args.inceptionDate) {
      throw new ConvexError("Next payment date must be after inception date");
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
    if (!existing) throw new ConvexError("Investment not found");

    // Validate financial fields if provided
    if (fields.investmentAmount !== undefined && fields.investmentAmount <= 0)
      throw new ConvexError("Investment amount must be greater than 0");
    if (fields.interestRate !== undefined && fields.interestRate < 0)
      throw new ConvexError("Interest rate cannot be negative");
    if (fields.totalPaymentsReceived !== undefined && fields.totalPaymentsReceived < 0)
      throw new ConvexError("Total payments received cannot be negative");
    if (fields.nextPaymentDate !== undefined && isNaN(fields.nextPaymentDate))
      throw new ConvexError("Invalid next payment date");

    // Cross-field date validation
    if (fields.nextPaymentDate !== undefined) {
      const effectiveInceptionDate = existing.inceptionDate;
      if (fields.nextPaymentDate <= effectiveInceptionDate) {
        throw new ConvexError("Next payment date must be after inception date");
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
    if (!existing) throw new ConvexError("Investment not found");
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
      throw new ConvexError(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }

    const results: { loanId: string; success: boolean; error?: string }[] = [];

    for (const loanId of args.loanIds) {
      const loan = await ctx.db.get(loanId);
      if (!loan) {
        results.push({ loanId, success: false, error: "Loan not found" });
        continue;
      }

      if (loan.returnedDate && args.status !== "closed") {
        results.push({ loanId, success: false, error: "Cannot change status after funds have been marked returned" });
        continue;
      }

      if (loan.status === args.status) {
        results.push({ loanId, success: true });
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
    if (!profile) throw new ConvexError("Investor not found");
    if (profile.role !== "investor") throw new ConvexError("User is not an investor");

    const investments = await ctx.db
      .query("investments")
      .withIndex("by_investorId", (q) => q.eq("investorId", args.id))
      .collect();

    return { profile, investments };
  },
});
