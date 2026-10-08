import { query, mutation, internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireRole } from "./lib/auth";
import { formatCurrencyPlain } from "./lib/constants";
import { parseUsDate } from "./lib/dates";
import {
  getDrawWireDateError,
  validateDrawWireDateForLoan,
} from "./lib/drawDates";
import {
  calculateDrawProration,
  calculateMonthlyInterest,
  calculateMonthlyPaymentDue,
  calculatePrepaidInterest,
  getMonthlyInterestPeriodForDate,
  getMonthlyInterestPeriods,
  roundCents,
} from "./lib/loanCalculations";
import {
  FUNDING_LEDGER_ERROR,
  getFundingLedgerStatus,
  getPrincipalOutForPeriodStart,
  getPrincipalOutFromFundingLedger,
} from "./lib/fundingLedger";
import {
  isCombinedInterestChargeType,
  MAX_MONTHLY_INTEREST_PERIODS,
} from "./lib/financialRules";
import {
  getEligiblePaymentAmount,
  getPaidAmountForInterestGroup,
  syncInterestChargeStatusesForDueDate,
} from "./lib/interestChargeStatus";
import {
  getDeleteReasonError,
  getPaymentReminderTypeLabel,
} from "./lib/paymentReminders";
import { getAppConfiguration } from "./lib/settings";

const SYNC_BATCH_SIZE = 25;

const chargeStatusValidator = v.union(
  v.literal("scheduled"),
  v.literal("paid"),
  v.literal("waived")
);

function getChargeWindowEnd(windowDays: number) {
  const windowEnd = new Date();
  windowEnd.setHours(0, 0, 0, 0);
  windowEnd.setDate(windowEnd.getDate() + windowDays);
  return windowEnd;
}

async function getLoanDrawRequests(ctx: MutationCtx, loanId: Id<"loans">) {
  const draws: Doc<"drawRequests">[] = [];
  for await (const draw of ctx.db
    .query("drawRequests")
    .withIndex("by_loanId", (q) => q.eq("loanId", loanId))) {
    draws.push(draw);
  }
  return draws;
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
    if (existing.status === "scheduled") {
      await ctx.db.patch(existing._id, {
        ...charge,
        status: args.status ?? existing.status,
      });
    }
    return existing._id;
  }

  return await ctx.db.insert("loanCharges", charge);
}

function canCreateRegularMonthlyChargeForPeriod(loan: Doc<"loans">, periodDueDate: string, periodStartDate: Date) {
  if ((loan.paymentType ?? "monthly") === "balloon") return false;
  if (!loan.closeDate) return false;

  const closeDate = parseUsDate(loan.closeDate);
  if (!closeDate) return false;

  const firstRegularPeriodStart = new Date(closeDate.getFullYear(), closeDate.getMonth() + 1, 1);
  if (periodStartDate < firstRegularPeriodStart) return false;

  const maturityDate = loan.maturityDate ? parseUsDate(loan.maturityDate) : null;
  const dueDate = parseUsDate(periodDueDate);
  if (maturityDate && dueDate && dueDate > maturityDate) return false;

  return true;
}

async function upsertMonthlyInterestChargeForPeriodStart(
  ctx: MutationCtx,
  args: {
    loan: Doc<"loans">;
    drawRequests: Doc<"drawRequests">[];
    periodStartDate: Date;
    createdBy: Id<"userProfiles">;
  }
) {
  const period = getMonthlyInterestPeriodForDate({
    date: args.periodStartDate,
    paymentDueDay: args.loan.paymentDueDay,
  });
  if (!canCreateRegularMonthlyChargeForPeriod(args.loan, period.dueDate, period.periodStartDate)) {
    return null;
  }

  const periodPrincipalOut = getPrincipalOutForPeriodStart(
    args.loan,
    args.drawRequests,
    period.periodStartDate
  );
  const periodMonthlyInterest = calculateMonthlyInterest(periodPrincipalOut, args.loan.interestRate);
  if (periodMonthlyInterest <= 0) return null;

  return await upsertSingleLoanCharge(ctx, {
    loanId: args.loan._id,
    borrowerId: args.loan.borrowerId,
    type: "monthly_interest",
    amount: periodMonthlyInterest,
    principalBasis: periodPrincipalOut,
    interestRate: args.loan.interestRate,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    dueDate: period.dueDate,
    notes: "Monthly interest payment after closing.",
    createdBy: args.createdBy,
  });
}

async function upsertDrawProrationCharge(
  ctx: MutationCtx,
  args: {
    loan: Doc<"loans">;
    draw: Doc<"drawRequests">;
    wireDate: string;
    createdBy: Id<"userProfiles">;
  }
) {
  if ((args.loan.paymentType ?? "monthly") === "balloon") return null;
  const closeDate = args.loan.closeDate ? parseUsDate(args.loan.closeDate) : null;
  const wireDate = parseUsDate(args.wireDate);
  if (closeDate && wireDate && closeDate.getTime() === wireDate.getTime()) {
    return null;
  }

  const proration = calculateDrawProration({
    drawAmount: args.draw.amountRequested,
    annualRate: args.loan.interestRate,
    wireDate: args.wireDate,
    paymentDueDay: args.loan.paymentDueDay,
  });
  if (!proration || proration.amount <= 0) return null;

  const existing = await ctx.db
    .query("loanCharges")
    .withIndex("by_drawRequestId", (q) => q.eq("drawRequestId", args.draw._id))
    .first();

  const charge = {
    loanId: args.loan._id,
    borrowerId: args.loan.borrowerId,
    drawRequestId: args.draw._id,
    type: "draw_proration" as const,
    amount: proration.amount,
    principalBasis: args.draw.amountRequested,
    interestRate: args.loan.interestRate,
    periodStart: proration.periodStart,
    periodEnd: proration.periodEnd,
    dueDate: proration.dueDate,
    status: "scheduled" as const,
    perDiem: proration.perDiem,
    daysCharged: proration.daysCharged,
    notes: "Prorated interest from draw wire date through month end.",
    createdBy: args.createdBy,
  };

  if (existing) {
    if (existing.status === "scheduled") {
      await ctx.db.patch(existing._id, {
        ...charge,
        status: existing.status,
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
    const configuration = await getAppConfiguration(ctx);
    const drawRequests = await getLoanDrawRequests(ctx, loan._id);
    const ledgerStatus = getFundingLedgerStatus({
      savedDrawFundsUsed: loan.drawFundsUsed,
      draws: drawRequests,
    });
    if (!ledgerStatus.isReconciled) {
      throw new ConvexError(FUNDING_LEDGER_ERROR);
    }

    const currentPrincipalOut = getPrincipalOutFromFundingLedger(
      loan,
      drawRequests
    );
    const monthlyInterest = calculateMonthlyInterest(currentPrincipalOut, loan.interestRate);
    const monthlyPayment = calculateMonthlyPaymentDue({
      principalOut: currentPrincipalOut,
      annualRate: loan.interestRate,
      paymentType: loan.paymentType,
    });
    const closeDate = parseUsDate(loan.closeDate);
    const prepaidPrincipalOut = closeDate
      ? getPrincipalOutForPeriodStart(loan, drawRequests, closeDate, true)
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
      windowEnd: getChargeWindowEnd(
        configuration.operations.interestChargeWindowDays
      ),
      maxPeriods: MAX_MONTHLY_INTEREST_PERIODS,
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

    let syncedMonthlyChargeCount = 0;
    const syncedMonthlyPeriods = new Set<string>();
    const syncMonthlyChargeForPeriodStart = async (periodStartDate: Date) => {
      const period = getMonthlyInterestPeriodForDate({
        date: periodStartDate,
        paymentDueDay: loan.paymentDueDay,
      });
      if (syncedMonthlyPeriods.has(period.periodStart)) return;

      syncedMonthlyPeriods.add(period.periodStart);
      const chargeId = await upsertMonthlyInterestChargeForPeriodStart(ctx, {
        loan,
        drawRequests,
        periodStartDate: period.periodStartDate,
        createdBy: args.createdBy,
      });
      if (chargeId) syncedMonthlyChargeCount++;
    };

    if ((loan.paymentType ?? "monthly") !== "balloon") {
      for (const period of monthlyPeriods) {
        await syncMonthlyChargeForPeriodStart(period.periodStartDate);
      }

      for (const draw of drawRequests) {
        if (draw.status !== "approved" || !draw.wireDate) continue;
        if (draw.source === "opening_balance") continue;
        if (getDrawWireDateError(loan, draw.wireDate)) continue;

        const wireDate = parseUsDate(draw.wireDate);
        if (!wireDate) continue;

        await syncMonthlyChargeForPeriodStart(wireDate);
        await upsertDrawProrationCharge(ctx, {
          loan,
          draw,
          wireDate: draw.wireDate,
          createdBy: args.createdBy,
        });
      }
    }

    return { principalOut: currentPrincipalOut, monthlyInterest, monthlyChargesSynced: syncedMonthlyChargeCount };
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
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    validateDrawWireDateForLoan(loan, args.wireDate);
    const draw = await ctx.db.get(args.drawRequestId);
    if (!draw) throw new ConvexError("Draw request not found");
    if (draw.loanId !== loan._id) throw new ConvexError("Draw does not belong to loan");

    const drawRequests = await getLoanDrawRequests(ctx, loan._id);
    const ledgerStatus = getFundingLedgerStatus({
      savedDrawFundsUsed: loan.drawFundsUsed,
      draws: drawRequests,
    });
    if (!ledgerStatus.isReconciled) {
      throw new ConvexError(FUNDING_LEDGER_ERROR);
    }

    const principalOut = getPrincipalOutFromFundingLedger(loan, drawRequests);
    const monthlyPayment = calculateMonthlyPaymentDue({
      principalOut,
      annualRate: loan.interestRate,
      paymentType: loan.paymentType,
    });
    await ctx.db.patch(loan._id, { monthlyPayment });

    const wireDate = parseUsDate(args.wireDate);
    if (wireDate) {
      await upsertMonthlyInterestChargeForPeriodStart(ctx, {
        loan,
        drawRequests,
        periodStartDate: wireDate,
        createdBy: args.createdBy,
      });
    }

    return await upsertDrawProrationCharge(ctx, {
      loan,
      draw,
      wireDate: args.wireDate,
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

async function getOpenChargeGroup(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  dueDate: string,
  charge?: Doc<"loanCharges">
) {
  if (charge && !isCombinedInterestChargeType(charge.type)) {
    return charge.status === "waived" ? [] : [charge];
  }
  const charges = await ctx.db
    .query("loanCharges")
    .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
    .collect();
  return charges.filter(
    (candidate) =>
      candidate.dueDate === dueDate &&
      candidate.status !== "waived" &&
      isCombinedInterestChargeType(candidate.type)
  );
}

async function getLoanPayments(ctx: MutationCtx, loanId: Id<"loans">) {
  return await ctx.db
    .query("loanPayments")
    .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
    .collect();
}

async function hasRelatedPayment(ctx: MutationCtx, loanId: Id<"loans">, charges: Doc<"loanCharges">[]) {
  const chargeIds = new Set(charges.map((charge) => charge._id));
  const dueDates = new Set(charges.map((charge) => charge.dueDate));
  return (await getLoanPayments(ctx, loanId)).some((payment) =>
    payment.chargeId ? chargeIds.has(payment.chargeId) : dueDates.has(payment.dueDate)
  );
}

function requireDeleteReason(reason: string) {
  const error = getDeleteReasonError(reason);
  if (error) throw new ConvexError({ publicMessage: error });
  return reason.trim();
}

async function requireLoan(ctx: MutationCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get(loanId);
  if (!loan) throw new ConvexError("Loan not found");
  return loan;
}

async function syncCombinedInterestStatuses(
  ctx: MutationCtx,
  loanId: Id<"loans">,
  charges: Doc<"loanCharges">[]
) {
  const dueDates = new Set(
    charges
      .filter((charge) => isCombinedInterestChargeType(charge.type))
      .map((charge) => charge.dueDate)
  );
  for (const dueDate of dueDates) {
    await syncInterestChargeStatusesForDueDate(ctx, { loanId, dueDate });
  }
}

async function waiveCharges(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  loanId: Id<"loans">,
  charges: Doc<"loanCharges">[],
  reason: string
) {
  const waivedAt = Date.now();
  for (const charge of charges) {
    await ctx.db.patch(charge._id, {
      status: "waived",
      waiver: {
        reason,
        waivedBy: admin._id,
        waivedAt,
        previousStatus: charge.status === "paid" ? "paid" : "scheduled",
      },
    });
  }
  await syncCombinedInterestStatuses(ctx, loanId, charges);
}

export const removeCharge = mutation({
  args: { id: v.id("loanCharges"), reason: v.string() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const reason = requireDeleteReason(args.reason);
    const charge = await ctx.db.get(args.id);
    if (!charge) throw new ConvexError("Charge not found");
    if (charge.status === "waived") return args.id;
    const loan = await requireLoan(ctx, charge.loanId);

    if (
      charge.status === "paid" &&
      (await hasRelatedPayment(
        ctx,
        loan._id,
        await getOpenChargeGroup(ctx, loan._id, charge.dueDate, charge)
      ))
    ) {
      throw new ConvexError({
        publicMessage: "This charge is paid. Delete its payments before deleting the charge.",
      });
    }

    await waiveCharges(ctx, admin, loan._id, [charge], reason);
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "charge.remove",
      entityType: "loan",
      entityId: loan._id,
      details: `Removed ${getPaymentReminderTypeLabel(charge.type).toLowerCase()} charge of ${formatCurrencyPlain(charge.amount)} due ${charge.dueDate} · ${loan.propertyAddress}\nReason: ${reason}`,
      metadata: JSON.stringify({ chargeIds: [charge._id] }),
    });

    return args.id;
  },
});

async function waiveReminderCharges(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  loan: Doc<"loans">,
  dueDate: string,
  chargeId: Id<"loanCharges"> | undefined,
  reason: string
) {
  const charge = chargeId ? await ctx.db.get(chargeId) : undefined;
  if (charge === null || (charge && (charge.loanId !== loan._id || charge.dueDate !== dueDate))) {
    throw new ConvexError("Charge not found");
  }

  const reminderCharges = await getOpenChargeGroup(ctx, loan._id, dueDate, charge);
  const scheduledCharges = reminderCharges.filter((item) => item.status === "scheduled");
  if (scheduledCharges.length === 0) return null;

  const payments = await getLoanPayments(ctx, loan._id);
  const unpaidAmount = Math.max(
    0,
    roundCents(
      reminderCharges.reduce((sum, item) => sum + item.amount, 0) -
        getPaidAmountForInterestGroup(payments, reminderCharges, dueDate)
    )
  );
  await waiveCharges(ctx, admin, loan._id, scheduledCharges, reason);
  return {
    type: [...new Set(scheduledCharges.map((item) => item.type))].join("+"),
    amount: unpaidAmount,
    metadata: { chargeIds: scheduledCharges.map((item) => item._id) },
  };
}

async function dismissMonthlyPaymentReminder(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  loan: Doc<"loans">,
  dueDate: string,
  reason: string
) {
  if (!parseUsDate(dueDate)) throw new ConvexError("Due date is invalid");
  const existing = await ctx.db
    .query("paymentReminderDismissals")
    .withIndex("by_loanId_and_dueDate", (q) => q.eq("loanId", loan._id).eq("dueDate", dueDate))
    .unique();
  if (existing) return null;

  const paidAmount = (await getLoanPayments(ctx, loan._id))
    .filter((payment) => payment.dueDate === dueDate)
    .reduce((sum, payment) => sum + getEligiblePaymentAmount(payment), 0);
  const amount = Math.max(0, roundCents(loan.monthlyPayment - paidAmount));
  const dismissalId = await ctx.db.insert("paymentReminderDismissals", {
    loanId: loan._id,
    dueDate,
    amount,
    reason,
    dismissedBy: admin._id,
  });
  return { type: "monthly_payment", amount, metadata: { dismissalId } };
}

export const deletePaymentReminder = mutation({
  args: {
    loanId: v.id("loans"),
    dueDate: v.string(),
    source: v.union(v.literal("scheduled_charge"), v.literal("monthly_payment")),
    chargeId: v.optional(v.id("loanCharges")),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const reason = requireDeleteReason(args.reason);
    const loan = await requireLoan(ctx, args.loanId);

    const deleted =
      args.source === "monthly_payment"
        ? await dismissMonthlyPaymentReminder(ctx, admin, loan, args.dueDate, reason)
        : await waiveReminderCharges(ctx, admin, loan, args.dueDate, args.chargeId, reason);
    if (!deleted) return { deleted: false };

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "payment_reminder.delete",
      entityType: "loan",
      entityId: loan._id,
      details: `${getPaymentReminderTypeLabel(deleted.type)} of ${formatCurrencyPlain(deleted.amount)} due ${args.dueDate} · ${loan.propertyAddress}\nReason: ${reason}`,
      metadata: JSON.stringify(deleted.metadata),
    });

    return { deleted: true };
  },
});

export const restoreCharge = mutation({
  args: { id: v.id("loanCharges") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const charge = await ctx.db.get(args.id);
    if (!charge) throw new ConvexError("Charge not found");
    if (charge.status !== "waived") return { restored: false };
    const loan = await requireLoan(ctx, charge.loanId);

    await ctx.db.patch(charge._id, {
      status:
        charge.waiver?.previousStatus ??
        (charge.type === "prepaid_interest" ? "paid" : "scheduled"),
      waiver: undefined,
    });
    await syncCombinedInterestStatuses(ctx, loan._id, [charge]);
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "charge.restore",
      entityType: "loan",
      entityId: loan._id,
      details: `Restored ${getPaymentReminderTypeLabel(charge.type).toLowerCase()} charge of ${formatCurrencyPlain(charge.amount)} due ${charge.dueDate} · ${loan.propertyAddress}`,
      metadata: JSON.stringify({ chargeIds: [charge._id] }),
    });

    return { restored: true };
  },
});

export const restorePaymentReminder = mutation({
  args: { id: v.id("paymentReminderDismissals") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const dismissal = await ctx.db.get(args.id);
    if (!dismissal) return { restored: false };
    const loan = await requireLoan(ctx, dismissal.loanId);

    await ctx.db.delete(dismissal._id);
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "payment_reminder.restore",
      entityType: "loan",
      entityId: loan._id,
      details: `Restored monthly payment reminder due ${dismissal.dueDate} · ${loan.propertyAddress}`,
    });

    return { restored: true };
  },
});

export const getDeletedPaymentItemsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const charges = await ctx.db
      .query("loanCharges")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();
    const dismissals = await ctx.db
      .query("paymentReminderDismissals")
      .withIndex("by_loanId_and_dueDate", (q) => q.eq("loanId", args.loanId))
      .collect();

    const items = [
      ...charges
        .filter((charge) => charge.status === "waived")
        .map((charge) => ({
          kind: "charge" as const,
          id: charge._id,
          type: charge.type as string,
          amount: charge.amount,
          dueDate: charge.dueDate,
          reason: charge.waiver?.reason,
          deletedBy: charge.waiver?.waivedBy,
          deletedAt: charge.waiver?.waivedAt,
        })),
      ...dismissals.map((dismissal) => ({
        kind: "reminder" as const,
        id: dismissal._id,
        type: "monthly_payment",
        amount: dismissal.amount,
        dueDate: dismissal.dueDate,
        reason: dismissal.reason,
        deletedBy: dismissal.dismissedBy,
        deletedAt: dismissal._creationTime,
      })),
    ];

    const names = new Map<Id<"userProfiles">, string>();
    for (const profileId of new Set(items.flatMap((item) => (item.deletedBy ? [item.deletedBy] : [])))) {
      const profile = await ctx.db.get(profileId);
      if (profile) names.set(profileId, profile.displayName);
    }

    return items
      .map(({ deletedBy, ...item }) => ({
        ...item,
        deletedByName: deletedBy ? names.get(deletedBy) : undefined,
      }))
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
  },
});
