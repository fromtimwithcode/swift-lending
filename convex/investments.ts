import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import schema from "./schema";
import { requireAdmin, requireRole } from "./lib/auth";
import { formatCurrencyPlain, PAYMENT_METHOD_LABELS } from "./lib/constants";
import { roundCents } from "./lib/financialRules";
import {
  formatCalendarDay,
  getBusinessCalendarDay,
  getInvestmentTermsError,
  getPayoutError,
  isCalendarDay,
  type InvestmentTerms,
} from "./lib/investmentSchedule";
import { getInvestmentTerms, loadInvestorPortfolio } from "./lib/investorPortfolio";

const termsArgs = {
  investmentAmount: v.number(),
  interestRate: v.number(),
  inceptionDate: v.number(),
  firstPaymentDate: v.number(),
  priorPaymentsReceived: v.number(),
  notes: v.optional(v.string()),
};

function publicError(message: string) {
  return new ConvexError({ publicMessage: message });
}

function parseTerms(args: InvestmentTerms & { notes?: string }) {
  const terms: InvestmentTerms = {
    investmentAmount: roundCents(args.investmentAmount),
    interestRate: args.interestRate,
    inceptionDate: args.inceptionDate,
    firstPaymentDate: args.firstPaymentDate,
    priorPaymentsReceived: roundCents(args.priorPaymentsReceived),
  };
  const error = getInvestmentTermsError(terms);
  if (error) throw publicError(error.message);
  return { ...terms, notes: args.notes?.trim() || undefined };
}

async function requireInvestment(ctx: MutationCtx, id: Id<"investments">) {
  const investment = await ctx.db.get("investments", id);
  if (!investment) throw publicError("This investment no longer exists.");
  return investment;
}

async function describeInvestment(ctx: MutationCtx, investment: Doc<"investments">) {
  const investor = await ctx.db.get("userProfiles", investment.investorId);
  return `${investor?.displayName ?? "Unknown investor"}'s ${formatCurrencyPlain(investment.investmentAmount)} investment`;
}

function describeTermChanges(before: InvestmentTerms, after: InvestmentTerms) {
  const fields: [keyof InvestmentTerms, string, (value: number) => string][] = [
    ["investmentAmount", "Amount", formatCurrencyPlain],
    ["interestRate", "Rate", (value) => `${value}%`],
    ["inceptionDate", "Inception", formatCalendarDay],
    ["firstPaymentDate", "First payment", formatCalendarDay],
    ["priorPaymentsReceived", "Paid before tracking", formatCurrencyPlain],
  ];
  return fields
    .filter(([key]) => before[key] !== after[key])
    .map(([key, label, format]) => `${label}: ${format(before[key])} → ${format(after[key])}`);
}

async function logInvestmentActivity(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  action: string,
  investmentId: Id<"investments">,
  details: string
) {
  await ctx.runMutation(internal.activityLog.log, {
    userId: admin._id,
    userName: admin.displayName,
    action,
    entityType: "investment",
    entityId: investmentId,
    details,
  });
}

function parseToday(today: number) {
  if (!isCalendarDay(today)) throw new ConvexError("Invalid date");
  return today;
}

// Callers pass today's business date so cached results never outlive the day.
export const getInvestorDetail = query({
  args: { id: v.id("userProfiles"), today: v.number() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const profile = await ctx.db.get("userProfiles", args.id);
    if (!profile || profile.role !== "investor") throw new ConvexError("Investor not found");
    return {
      profile,
      ...(await loadInvestorPortfolio(ctx, profile._id, parseToday(args.today))),
    };
  },
});

export const getMyPortfolio = query({
  args: { today: v.number() },
  handler: async (ctx, args) => {
    const profile = await requireRole(ctx, "investor");
    return await loadInvestorPortfolio(ctx, profile._id, parseToday(args.today));
  },
});

export const create = mutation({
  args: { investorId: v.id("userProfiles"), ...termsArgs },
  handler: async (ctx, { investorId, ...args }) => {
    const admin = await requireAdmin(ctx);
    const investor = await ctx.db.get("userProfiles", investorId);
    if (!investor || investor.role !== "investor") throw publicError("This investor no longer exists.");
    if (!investor.isActive) throw publicError("Activate this investor before adding investments.");
    const terms = parseTerms(args);
    const id = await ctx.db.insert("investments", { investorId, ...terms });
    await logInvestmentActivity(
      ctx,
      admin,
      "investment.create",
      id,
      `Created ${formatCurrencyPlain(terms.investmentAmount)} investment at ${terms.interestRate}% for ${investor.displayName}, starting ${formatCalendarDay(terms.inceptionDate)} with the first payment due ${formatCalendarDay(terms.firstPaymentDate)}`
    );
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("investments"), ...termsArgs },
  handler: async (ctx, { id, ...args }) => {
    const admin = await requireAdmin(ctx);
    const investment = await requireInvestment(ctx, id);
    const terms = parseTerms(args);
    const changes = describeTermChanges(getInvestmentTerms(investment), terms);
    await ctx.db.patch("investments", id, {
      ...terms,
      totalPaymentsReceived: undefined,
      nextPaymentDate: undefined,
    });
    if (terms.notes !== investment.notes) changes.push("Notes updated");
    if (changes.length === 0) return id;
    await logInvestmentActivity(
      ctx,
      admin,
      "investment.update",
      id,
      `Updated ${await describeInvestment(ctx, investment)}\n${changes.join("\n")}`
    );
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("investments") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const investment = await requireInvestment(ctx, args.id);
    const payout = await ctx.db
      .query("investorPayouts")
      .withIndex("by_investmentId_and_paidDate", (q) => q.eq("investmentId", args.id))
      .first();
    if (payout)
      throw publicError("Delete this investment's recorded payments before deleting the investment.");
    const description = await describeInvestment(ctx, investment);
    await ctx.db.delete("investments", args.id);
    await logInvestmentActivity(ctx, admin, "investment.delete", args.id, `Deleted ${description}`);
  },
});

export const recordPayout = mutation({
  args: {
    investmentId: v.id("investments"),
    amount: v.number(),
    paidDate: v.number(),
    method: schema.tables.investorPayouts.validator.fields.method,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const investment = await requireInvestment(ctx, args.investmentId);
    const amount = roundCents(args.amount);
    const error = getPayoutError(
      { amount, paidDate: args.paidDate },
      getInvestmentTerms(investment),
      getBusinessCalendarDay()
    );
    if (error) throw publicError(error.message);
    const id = await ctx.db.insert("investorPayouts", {
      investmentId: args.investmentId,
      amount,
      paidDate: args.paidDate,
      method: args.method,
      notes: args.notes?.trim() || undefined,
      recordedBy: admin._id,
    });
    await logInvestmentActivity(
      ctx,
      admin,
      "investment.payout",
      args.investmentId,
      `Recorded ${formatCurrencyPlain(amount)} ${PAYMENT_METHOD_LABELS[args.method]} payment on ${formatCalendarDay(args.paidDate)} for ${await describeInvestment(ctx, investment)}`
    );
    return id;
  },
});

export const removePayout = mutation({
  args: { id: v.id("investorPayouts") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const payout = await ctx.db.get("investorPayouts", args.id);
    if (!payout) return { deleted: false };
    const investment = await requireInvestment(ctx, payout.investmentId);
    await ctx.db.delete("investorPayouts", args.id);
    await logInvestmentActivity(
      ctx,
      admin,
      "investment.payoutDelete",
      payout.investmentId,
      `Deleted ${formatCurrencyPlain(payout.amount)} payment from ${formatCalendarDay(payout.paidDate)} for ${await describeInvestment(ctx, investment)}`
    );
    return { deleted: true };
  },
});
