import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_BULK_OPERATION_SIZE, formatCurrencyPlain } from "./lib/constants";

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

export const getAllPaymentsSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // TODO(scale): Unbounded .collect() on all payments — worst scaling offender, paginate or aggregate at scale
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
    amount: v.number(),
    paymentDate: v.string(),
    dueDate: v.string(),
    method: methodValidator,
    status: statusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    if (args.amount < 0) throw new Error("Payment amount cannot be negative");
    if (args.amount === 0 && args.status !== "missed") throw new Error("Payment amount must be positive for non-missed payments");

    // Validate date format and actual date validity
    function parseAndValidateDate(dateStr: string, label: string): Date {
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      if (!dateRegex.test(dateStr)) {
        throw new Error(`${label} must be in MM/DD/YYYY format`);
      }
      const [month, day, year] = dateStr.split("/").map(Number);
      const date = new Date(year, month - 1, day);
      // Verify the date components match (catches impossible dates like 02/31)
      if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
        throw new Error(`${label} is not a valid calendar date`);
      }
      return date;
    }

    const paymentDate = parseAndValidateDate(args.paymentDate, "Payment date");
    parseAndValidateDate(args.dueDate, "Due date");

    // Reject future payment dates
    if (paymentDate > new Date()) {
      throw new Error("Payment date cannot be in the future");
    }

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");

    // Only allow payments on funded/active loans
    if (!["funded", "closed", "sent_to_title"].includes(loan.status)) {
      throw new Error("Payments can only be recorded for funded, sent to title, or closed loans");
    }

    const trimmedNotes = args.notes?.trim() || undefined;

    const id = await ctx.db.insert("loanPayments", {
      ...args,
      notes: trimmedNotes,
      recordedBy: admin._id,
    });

    // Notify borrower (skip for missed payments — $0 notification is confusing)
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

    return id;
  },
});

export const bulkDeletePayments = mutation({
  args: {
    paymentIds: v.array(v.id("loanPayments")),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    if (args.paymentIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new Error(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }
    let deleted = 0;
    for (const paymentId of args.paymentIds) {
      const existing = await ctx.db.get(paymentId);
      if (!existing) continue;
      await ctx.db.delete(paymentId);
      deleted++;
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
    if (!existing) throw new Error("Payment not found");
    await ctx.db.delete(args.id);

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
