import { query, mutation, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin, requireRole } from "./lib/auth";
import { internal } from "./_generated/api";
import { DEFAULT_PAYMENT_DUE_DAY, MAX_BULK_OPERATION_SIZE, formatCurrencyPlain } from "./lib/constants";

const REMINDER_WINDOW_DAYS = 14;
const PAYMENT_REMINDER_BATCH_SIZE = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const methodValidator = v.union(
  v.literal("ach"),
  v.literal("wire"),
  v.literal("check"),
  v.literal("other")
);

const statusValidator = v.union(
  v.literal("on_time"),
  v.literal("late"),
  v.literal("partial"),
  v.literal("missed")
);

type LoanDoc = Doc<"loans">;
type LoanPaymentDoc = Doc<"loanPayments">;
type LoanChargeDoc = Doc<"loanCharges">;

function parseUsDate(value: string | undefined) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function formatUsDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function daysUntil(dueDate: Date, today: Date) {
  return Math.round((dueDate.getTime() - today.getTime()) / MS_PER_DAY);
}

function getDueDate(year: number, monthIndex: number, paymentDueDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return new Date(year, monthIndex, Math.min(paymentDueDay, lastDay));
}

function addMonths(date: Date, months: number, paymentDueDay: number) {
  return getDueDate(date.getFullYear(), date.getMonth() + months, paymentDueDay);
}

function getEligiblePaymentAmount(payment: LoanPaymentDoc) {
  return payment.status === "missed" ? 0 : payment.amount;
}

function roundCents(value: number) {
  return Math.round(value * 100) / 100;
}

function getPaidAmountForDueDate(payments: LoanPaymentDoc[], dueDate: string) {
  return payments.reduce((sum, payment) => {
    if (payment.dueDate !== dueDate) return sum;
    return sum + getEligiblePaymentAmount(payment);
  }, 0);
}

function getRemainingAmount(expectedAmount: number, paidAmount: number) {
  return Math.max(0, roundCents(expectedAmount - paidAmount));
}

function shouldTrackMonthlyPayments(loan: LoanDoc, today: Date) {
  if (loan.returnedDate) return false;
  if ((loan.paymentType ?? "monthly") === "balloon") return false;
  if (loan.monthlyPayment <= 0) return false;
  if (loan.status === "funded" || loan.status === "sent_to_title") return true;

  if (loan.status === "closed") {
    const maturity = parseUsDate(loan.maturityDate);
    return maturity !== null && maturity >= today;
  }

  return false;
}

function isPayoffOnlyInterestCharge(loan: LoanDoc, charge: LoanChargeDoc) {
  return (
    (loan.paymentType ?? "monthly") === "balloon" &&
    (charge.type === "monthly_interest" || charge.type === "draw_proration")
  );
}

function getMonthlyDueDates(loan: LoanDoc, windowEnd: Date) {
  const closeDate = parseUsDate(loan.closeDate);
  if (!closeDate) return [];

  const paymentDueDay = loan.paymentDueDay ?? DEFAULT_PAYMENT_DUE_DAY;
  const firstDueDate = getDueDate(closeDate.getFullYear(), closeDate.getMonth() + 2, paymentDueDay);
  const maturityDate = parseUsDate(loan.maturityDate);
  const effectiveEnd = maturityDate && maturityDate < windowEnd ? maturityDate : windowEnd;
  const dueDates: Date[] = [];

  for (let dueDate = firstDueDate; dueDate <= effectiveEnd; dueDate = addMonths(dueDate, 1, paymentDueDay)) {
    dueDates.push(dueDate);
  }

  return dueDates;
}

function reminderStatus(days: number): "past_due" | "due_soon" {
  return days < 0 ? "past_due" : "due_soon";
}

function getNotificationCadence(daysUntilDue: number) {
  if (daysUntilDue === 7) return "seven_days_before";
  if (daysUntilDue === 0) return "due_today";
  if (daysUntilDue === -1) return "one_day_past_due";
  if (daysUntilDue < -1 && Math.abs(daysUntilDue) % 7 === 0) {
    return `${Math.abs(daysUntilDue)}_days_past_due`;
  }
  return null;
}

function paymentReminderTitle(daysUntilDue: number) {
  if (daysUntilDue < 0) return "Payment Past Due";
  if (daysUntilDue === 0) return "Payment Due Today";
  return "Payment Due Soon";
}

function paymentReminderBody(args: {
  amount: number;
  propertyAddress: string;
  dueDate: string;
  daysUntilDue: number;
}) {
  if (args.daysUntilDue < 0) {
    const days = Math.abs(args.daysUntilDue);
    return `${formatCurrencyPlain(args.amount)} is past due for ${args.propertyAddress}. It was due on ${args.dueDate} (${days} day${days === 1 ? "" : "s"} ago).`;
  }

  if (args.daysUntilDue === 0) {
    return `${formatCurrencyPlain(args.amount)} is due today for ${args.propertyAddress}.`;
  }

  return `${formatCurrencyPlain(args.amount)} is due on ${args.dueDate} for ${args.propertyAddress}.`;
}

function addReminder(
  reminders: Array<{
    loanId: Id<"loans">;
    borrowerName: string;
    propertyAddress: string;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
    status: "past_due" | "due_soon";
    source: "scheduled_charge" | "monthly_payment";
    type: string;
    chargeId?: Id<"loanCharges">;
  }>,
  args: {
    loan: LoanDoc;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
    source: "scheduled_charge" | "monthly_payment";
    type: string;
    chargeId?: Id<"loanCharges">;
  }
) {
  const base = {
    loanId: args.loan._id,
    borrowerName: args.loan.borrowerName,
    propertyAddress: args.loan.propertyAddress,
    amount: args.amount,
    dueDate: args.dueDate,
    daysUntilDue: args.daysUntilDue,
    status: reminderStatus(args.daysUntilDue),
    source: args.source,
    type: args.type,
  };
  reminders.push(args.chargeId ? { ...base, chargeId: args.chargeId } : base);
}

function groupByLoan<T extends { loanId: Id<"loans"> }>(items: T[]) {
  const grouped = new Map<Id<"loans">, T[]>();
  for (const item of items) {
    const existing = grouped.get(item.loanId);
    if (existing) existing.push(item);
    else grouped.set(item.loanId, [item]);
  }
  return grouped;
}

async function getReminderData(
  ctx: QueryCtx | MutationCtx,
  loans: LoanDoc[],
  preloaded?: {
    payments?: LoanPaymentDoc[];
    charges?: LoanChargeDoc[];
  }
) {
  const today = startOfToday();
  const windowEnd = new Date(today);
  windowEnd.setDate(today.getDate() + REMINDER_WINDOW_DAYS);
  const reminders: Array<{
    loanId: Id<"loans">;
    borrowerName: string;
    propertyAddress: string;
    amount: number;
    dueDate: string;
    daysUntilDue: number;
    status: "past_due" | "due_soon";
    source: "scheduled_charge" | "monthly_payment";
    type: string;
    chargeId?: Id<"loanCharges">;
  }> = [];

  const paymentsByLoan = preloaded?.payments ? groupByLoan(preloaded.payments) : null;
  const chargesByLoan = preloaded?.charges ? groupByLoan(preloaded.charges) : null;

  for (const loan of loans) {
    if (loan.returnedDate) continue;

    const payments = paymentsByLoan
      ? paymentsByLoan.get(loan._id) ?? []
      : await ctx.db
          .query("loanPayments")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect();
    const charges = chargesByLoan
      ? chargesByLoan.get(loan._id) ?? []
      : await ctx.db
          .query("loanCharges")
          .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
          .collect();
    const chargesByDueDate = new Map<string, LoanChargeDoc[]>();
    for (const charge of charges) {
      const existing = chargesByDueDate.get(charge.dueDate);
      if (existing) existing.push(charge);
      else chargesByDueDate.set(charge.dueDate, [charge]);
    }
    const chargeDueDates = new Set(charges.map((charge) => charge.dueDate));

    for (const charge of charges) {
      if (isPayoffOnlyInterestCharge(loan, charge)) continue;
      if (charge.status !== "scheduled") continue;
      const dueDate = parseUsDate(charge.dueDate);
      if (!dueDate) continue;
      const dueInDays = daysUntil(dueDate, today);
      if (dueInDays > REMINDER_WINDOW_DAYS) continue;
      const remainingAmount = getRemainingAmount(
        charge.amount,
        getPaidAmountForCharge(payments, charge, chargesByDueDate.get(charge.dueDate))
      );
      if (remainingAmount <= 0.01) continue;

      addReminder(reminders, {
        loan,
        amount: remainingAmount,
        dueDate: charge.dueDate,
        daysUntilDue: dueInDays,
        source: "scheduled_charge",
        type: charge.type,
        chargeId: charge._id,
      });
    }

    if (!shouldTrackMonthlyPayments(loan, today)) continue;
    const monthlyDueDates = getMonthlyDueDates(loan, windowEnd);
    const getRemainingMonthlyAmount = (monthlyDueDate: Date) => {
      const dueDate = formatUsDate(monthlyDueDate);
      if (chargeDueDates.has(dueDate)) return 0;
      if (daysUntil(monthlyDueDate, today) > REMINDER_WINDOW_DAYS) return 0;
      return getRemainingAmount(loan.monthlyPayment, getPaidAmountForDueDate(payments, dueDate));
    };

    const latestUnpaidDueDate = [...monthlyDueDates]
      .filter((monthlyDueDate) => monthlyDueDate <= today)
      .reverse()
      .find((monthlyDueDate) => getRemainingMonthlyAmount(monthlyDueDate) > 0.01);
    const nextUnpaidDueDate = monthlyDueDates
      .filter((monthlyDueDate) => monthlyDueDate > today)
      .find((monthlyDueDate) => getRemainingMonthlyAmount(monthlyDueDate) > 0.01);

    for (const monthlyDueDate of [latestUnpaidDueDate, nextUnpaidDueDate].filter(
      (dueDate): dueDate is Date => dueDate !== undefined
    )) {
      const dueDate = formatUsDate(monthlyDueDate);
      const dueInDays = daysUntil(monthlyDueDate, today);

      addReminder(reminders, {
        loan,
        amount: getRemainingMonthlyAmount(monthlyDueDate),
        dueDate,
        daysUntilDue: dueInDays,
        source: "monthly_payment",
        type: "monthly_payment",
      });
    }
  }

  reminders.sort((a, b) => {
    if (a.status !== b.status) return a.status === "past_due" ? -1 : 1;
    return a.daysUntilDue - b.daysUntilDue;
  });

  return {
    reminders: reminders.slice(0, 25),
    pastDueCount: reminders.filter((reminder) => reminder.status === "past_due").length,
    dueSoonCount: reminders.filter((reminder) => reminder.status === "due_soon").length,
    totalAmountDue: reminders.reduce((sum, reminder) => sum + reminder.amount, 0),
    windowDays: REMINDER_WINDOW_DAYS,
  };
}

async function findChargeForPayment(
  ctx: MutationCtx,
  args: {
    loanId: Id<"loans">;
    chargeId?: Id<"loanCharges">;
    dueDate: string;
    amount: number;
  }
) {
  if (args.chargeId) {
    const charge = await ctx.db.get(args.chargeId);
    if (!charge) throw new ConvexError("Scheduled charge not found");
    if (charge.loanId !== args.loanId) throw new ConvexError("Scheduled charge does not belong to this loan");
    if (charge.status === "waived") throw new ConvexError("Cannot record a payment against a waived charge");
    return charge;
  }

  const charges = await ctx.db
    .query("loanCharges")
    .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
    .collect();

  const matchingCharges = charges.filter(
    (charge) =>
      charge.status === "scheduled" &&
      charge.dueDate === args.dueDate
  );

  const exactAmountMatch = matchingCharges.find((charge) => Math.abs(charge.amount - args.amount) < 0.01);
  if (exactAmountMatch) return exactAmountMatch;
  return matchingCharges.length === 1 ? matchingCharges[0] : undefined;
}

function isPaidPaymentStatus(status: LoanPaymentDoc["status"]) {
  return status !== "missed";
}

function getPaidAmountForCharge(
  payments: LoanPaymentDoc[],
  charge: LoanChargeDoc,
  sameDueDateCharges?: LoanChargeDoc[]
) {
  const canCountUnlinkedDueDatePayments =
    sameDueDateCharges === undefined || sameDueDateCharges.filter((item) => item.status !== "waived").length === 1;

  return payments.reduce((sum, payment) => {
    if (payment.status === "missed") return sum;
    if (payment.chargeId === charge._id) return sum + payment.amount;
    if (canCountUnlinkedDueDatePayments && !payment.chargeId && payment.dueDate === charge.dueDate) {
      return sum + payment.amount;
    }
    return sum;
  }, 0);
}

async function reopenChargeIfNeeded(
  ctx: MutationCtx,
  chargeId: Id<"loanCharges">,
  excludingPaymentIds: Set<string>
) {
  const charge = await ctx.db.get(chargeId);
  if (!charge || charge.status !== "paid") return;

  const remainingPayments = await ctx.db
    .query("loanPayments")
    .withIndex("by_loanId", (q) => q.eq("loanId", charge.loanId))
    .collect();
  const paidAmount = remainingPayments.reduce(
    (sum, payment) => {
      if (excludingPaymentIds.has(payment._id)) return sum;
      if (payment.chargeId === charge._id) return sum + getEligiblePaymentAmount(payment);
      if (!payment.chargeId && payment.dueDate === charge.dueDate) return sum + getEligiblePaymentAmount(payment);
      return sum;
    },
    0
  );

  if (paidAmount + 0.01 < charge.amount) {
    await ctx.db.patch(chargeId, { status: "scheduled" });
  }
}

export const getPaymentsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .collect();
  },
});

export const getAdminPaymentReminders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const loans = await ctx.db.query("loans").collect();
    const payments = await ctx.db.query("loanPayments").collect();
    const charges = await ctx.db.query("loanCharges").collect();
    return await getReminderData(ctx, loans, { payments, charges });
  },
});

export const getMyPaymentReminders = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "borrower");
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();
    const charges = await ctx.db
      .query("loanCharges")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();
    return await getReminderData(ctx, loans, { charges });
  },
});

export const sendBorrowerPaymentReminderNotifications = internalMutation({
  args: {
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: PAYMENT_REMINDER_BATCH_SIZE, cursor: args.cursor ?? null });

    let notificationsQueued = 0;
    for (const loan of results.page) {
      if (loan.returnedDate) continue;

      const reminderData = await getReminderData(ctx, [loan]);
      for (const reminder of reminderData.reminders) {
        if (reminder.source !== "scheduled_charge") continue;
        const cadence = getNotificationCadence(reminder.daysUntilDue);
        if (!cadence) continue;

        await ctx.runMutation(internal.notifications.createNotification, {
          recipientId: loan.borrowerId,
          type: "payment_overdue",
          title: paymentReminderTitle(reminder.daysUntilDue),
          body: paymentReminderBody({
            amount: reminder.amount,
            propertyAddress: loan.propertyAddress,
            dueDate: reminder.dueDate,
            daysUntilDue: reminder.daysUntilDue,
          }),
          loanId: loan._id,
          dedupeKey: `payment_reminder:${loan.borrowerId}:${loan._id}:${reminder.chargeId ?? reminder.dueDate}:${cadence}`,
        });
        notificationsQueued++;
      }
    }

    if (!results.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.loanPayments.sendBorrowerPaymentReminderNotifications,
        { cursor: results.continueCursor }
      );
    }

    return { notificationsQueued, isDone: results.isDone };
  },
});

export const getAllPaymentsSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // TODO(scale): Unbounded .collect() on all payments - worst scaling offender, paginate or aggregate at scale
    const payments = await ctx.db.query("loanPayments").collect();

    // Exclude missed payments from revenue (missed = no money received)
    const totalRevenue = payments
      .filter((p) => p.status !== "missed")
      .reduce((sum, p) => sum + p.amount, 0);
    const latePaymentCount = payments.filter((p) => p.status === "late").length;

    // Group by month from paymentDate (MM/DD/YYYY), excluding missed
    const byMonth: Record<string, number> = {};
    for (const p of payments) {
      if (p.status === "missed") continue;
      const parts = p.paymentDate.split("/");
      const monthKey = parts.length >= 3 ? `${parts[0]}/${parts[2]}` : p.paymentDate;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + p.amount;
    }

    const monthlyRevenue = Object.entries(byMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => {
        // Sort numerically by year*100+month (format is "MM/YYYY")
        const [am, ay] = a.month.split("/").map(Number);
        const [bm, by_] = b.month.split("/").map(Number);
        return (ay * 100 + am) - (by_ * 100 + bm);
      });

    return { totalRevenue, latePaymentCount, monthlyRevenue };
  },
});

export const recordPayment = mutation({
  args: {
    loanId: v.id("loans"),
    chargeId: v.optional(v.id("loanCharges")),
    amount: v.number(),
    paymentDate: v.string(),
    dueDate: v.string(),
    method: methodValidator,
    status: statusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (args.amount < 0) throw new ConvexError("Payment amount cannot be negative");
    if (args.amount === 0 && args.status !== "missed") throw new ConvexError("Payment amount must be positive for non-missed payments");

    // Validate date format and actual date validity
    function parseAndValidateDate(dateStr: string, label: string): Date {
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      if (!dateRegex.test(dateStr)) {
        throw new ConvexError(`${label} must be in MM/DD/YYYY format`);
      }
      const [month, day, year] = dateStr.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      // Verify the date components match (catches impossible dates like 02/31)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new ConvexError(`${label} is not a valid calendar date`);
      }
      return date;
    }

    const paymentDate = parseAndValidateDate(args.paymentDate, "Payment date");
    parseAndValidateDate(args.dueDate, "Due date");

    // Reject future payment dates
    if (paymentDate > new Date()) {
      throw new ConvexError("Payment date cannot be in the future");
    }

    await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
      loanId: args.loanId,
      createdBy: admin._id,
    });

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (loan.returnedDate) {
      throw new ConvexError("Cannot record payments after funds have been marked returned");
    }

    // Only allow payments on funded/active loans
    if (!["funded", "closed", "sent_to_title"].includes(loan.status)) {
      throw new ConvexError("Payments can only be recorded for funded, sent to title, or closed loans");
    }

    const linkedCharge = await findChargeForPayment(ctx, args);
    const linkedChargeId = linkedCharge?._id;
    const trimmedNotes = args.notes?.trim() || undefined;
    const paymentFields = {
      loanId: args.loanId,
      amount: args.amount,
      paymentDate: args.paymentDate,
      dueDate: args.dueDate,
      method: args.method,
      status: args.status,
    };

    const id = await ctx.db.insert("loanPayments", {
      ...paymentFields,
      ...(linkedChargeId ? { chargeId: linkedChargeId } : {}),
      ...(trimmedNotes ? { notes: trimmedNotes } : {}),
      recordedBy: admin._id,
    });

    const loanPayments = linkedCharge
      ? await ctx.db
          .query("loanPayments")
          .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
          .collect()
      : [];
    const chargeMarkedPaid = Boolean(
      linkedChargeId &&
      linkedCharge &&
      isPaidPaymentStatus(args.status) &&
      getPaidAmountForCharge(loanPayments, linkedCharge) + 0.01 >= linkedCharge.amount
    );
    if (chargeMarkedPaid && linkedChargeId) {
      await ctx.db.patch(linkedChargeId, { status: "paid" });
    }

    // Notify borrower (skip for missed payments - $0 notification is confusing)
    if (args.status !== "missed") {
      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: loan.borrowerId,
        type: "payment_recorded",
        title: "Payment Recorded",
        body: `A payment of ${formatCurrencyPlain(args.amount)} has been recorded for ${loan.propertyAddress}.`,
        loanId: args.loanId,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "payment.record",
      entityType: "payment",
      entityId: id,
      details: `Recorded ${args.status} payment of ${formatCurrencyPlain(args.amount)} for ${loan.propertyAddress}`,
    });

    return { paymentId: id, chargeId: linkedChargeId ?? null, chargeMarkedPaid };
  },
});

export const bulkDeletePayments = mutation({
  args: {
    paymentIds: v.array(v.id("loanPayments")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.paymentIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new ConvexError(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }
    const deletingIds = new Set(args.paymentIds.map((id) => String(id)));
    const linkedChargeIds = new Set<Id<"loanCharges">>();
    let deleted = 0;
    for (const paymentId of args.paymentIds) {
      const existing = await ctx.db.get(paymentId);
      if (!existing) continue;
      if (existing.chargeId) linkedChargeIds.add(existing.chargeId);
      await ctx.db.delete(paymentId);
      deleted++;
    }

    for (const chargeId of linkedChargeIds) {
      await reopenChargeIfNeeded(ctx, chargeId, deletingIds);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "payment.bulkDelete",
      entityType: "payment",
      details: `Bulk deleted ${deleted} payments`,
    });
  },
});

export const deletePayment = mutation({
  args: { id: v.id("loanPayments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new ConvexError("Payment not found");
    await ctx.db.delete(args.id);
    if (existing.chargeId) {
      await reopenChargeIfNeeded(ctx, existing.chargeId, new Set([String(args.id)]));
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "payment.delete",
      entityType: "payment",
      entityId: args.id,
      details: `Deleted payment of ${formatCurrencyPlain(existing.amount)}`,
    });
  },
});
