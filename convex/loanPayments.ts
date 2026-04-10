import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

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

export const getPaymentStats = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const payments = await ctx.db
      .query("loanPayments")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();

    const totalReceived = payments.reduce((sum, p) => sum + p.amount, 0);
    const paymentCount = payments.length;
    const onTimeCount = payments.filter((p) => p.status === "on_time").length;
    const lateCount = payments.filter((p) => p.status === "late").length;
    const missedCount = payments.filter((p) => p.status === "missed").length;

    return { totalReceived, paymentCount, onTimeCount, lateCount, missedCount };
  },
});

export const getAllPaymentsSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const payments = await ctx.db.query("loanPayments").collect();

    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const latePaymentCount = payments.filter((p) => p.status === "late").length;

    // Group by month from paymentDate (MM/DD/YYYY)
    const byMonth: Record<string, number> = {};
    for (const p of payments) {
      const parts = p.paymentDate.split("/");
      const monthKey = parts.length >= 3 ? `${parts[0]}/${parts[2]}` : p.paymentDate;
      byMonth[monthKey] = (byMonth[monthKey] || 0) + p.amount;
    }

    const monthlyRevenue = Object.entries(byMonth)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

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
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");

    const id = await ctx.db.insert("loanPayments", {
      ...args,
      recordedBy: admin._id,
    });

    // Notify borrower
    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: loan.borrowerId,
      type: "payment_recorded",
      title: "Payment Recorded",
      body: `A payment of $${args.amount.toLocaleString()} has been recorded for ${loan.propertyAddress}.`,
      loanId: args.loanId,
    });

    return id;
  },
});

export const bulkDeletePayments = mutation({
  args: {
    paymentIds: v.array(v.id("loanPayments")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    if (args.paymentIds.length > 50) throw new Error("Maximum 50 items per bulk operation");
    for (const paymentId of args.paymentIds) {
      const existing = await ctx.db.get(paymentId);
      if (!existing) continue;
      await ctx.db.delete(paymentId);
    }
  },
});

export const deletePayment = mutation({
  args: { id: v.id("loanPayments") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const existing = await ctx.db.get(args.id);
    if (!existing) throw new Error("Payment not found");
    await ctx.db.delete(args.id);
  },
});
