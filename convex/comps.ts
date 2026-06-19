import { action, internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

const COMPARABLE_STATUSES = ["closed", "funded", "sent_to_title"] as const;
const MAX_INTERNAL_COMPS = 8;

type LoanDoc = Doc<"loans">;
type PropertyCompInput = {
  loanId: Id<"loans">;
  sourceLoanId?: Id<"loans">;
  address: string;
  salePrice: number;
  saleDate: string;
  sqft?: number;
  bedrooms?: number;
  bathrooms?: number;
  distanceMiles?: number;
  yearBuilt?: number;
  propertyType?: string;
  listingStatus?: string;
  listingType?: string;
  listedDate?: string;
  removedDate?: string;
  lastSeenDate?: string;
  daysOnMarket?: number;
  daysOld?: number;
  afterRepairValue?: number;
  rehabBudgetTotal?: number;
  loanAmount?: number;
  similarityScore?: number;
  fetchedAt?: number;
  source: string;
};

const propertyCompInputValidator = v.object({
  loanId: v.id("loans"),
  sourceLoanId: v.optional(v.id("loans")),
  address: v.string(),
  salePrice: v.number(),
  saleDate: v.string(),
  sqft: v.optional(v.number()),
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  distanceMiles: v.optional(v.number()),
  yearBuilt: v.optional(v.number()),
  propertyType: v.optional(v.string()),
  listingStatus: v.optional(v.string()),
  listingType: v.optional(v.string()),
  listedDate: v.optional(v.string()),
  removedDate: v.optional(v.string()),
  lastSeenDate: v.optional(v.string()),
  daysOnMarket: v.optional(v.number()),
  daysOld: v.optional(v.number()),
  afterRepairValue: v.optional(v.number()),
  rehabBudgetTotal: v.optional(v.number()),
  loanAmount: v.optional(v.number()),
  similarityScore: v.optional(v.number()),
  fetchedAt: v.optional(v.number()),
  source: v.string(),
});

export const getCompsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const comps = await ctx.db
      .query("propertyComps")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .take(50);

    return comps.filter((comp) => comp.source === "internal_loan");
  },
});

function isComparableStatus(status: LoanDoc["status"]) {
  return (COMPARABLE_STATUSES as readonly string[]).includes(status);
}

function formatUsDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function parseUsDateTime(value: string | undefined) {
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

  return date.getTime();
}

function getAddressParts(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const statePartIndex = parts.findIndex((part) => /\b[A-Z]{2}\b(?:\s+\d{5})?/.test(part));
  const stateMatch = address.match(/,\s*([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?(?:,|$)/);

  return {
    city: statePartIndex > 0 ? parts[statePartIndex - 1].toLowerCase() : undefined,
    state: stateMatch?.[1],
  };
}

function similarityPoints(targetValue: number | undefined, candidateValue: number | undefined, maxPoints: number) {
  if (!targetValue || !candidateValue) return 0;
  const percentDiff = Math.abs(candidateValue - targetValue) / targetValue;
  return Math.max(0, maxPoints - percentDiff * maxPoints * 3);
}

function getStatusPoints(status: LoanDoc["status"]) {
  if (status === "closed") return 12;
  if (status === "funded") return 10;
  if (status === "sent_to_title") return 8;
  return 0;
}

function getRecencyPoints(candidate: LoanDoc) {
  const dateTime = parseUsDateTime(candidate.closeDate) ?? candidate._creationTime;
  const monthsOld = Math.max(0, (Date.now() - dateTime) / (1000 * 60 * 60 * 24 * 30));
  return Math.max(0, 12 - monthsOld / 2);
}

function scoreComparableLoan(target: LoanDoc, candidate: LoanDoc) {
  const targetAddress = getAddressParts(target.propertyAddress);
  const candidateAddress = getAddressParts(candidate.propertyAddress);

  let score = 0;
  if (targetAddress.state && targetAddress.state === candidateAddress.state) score += 18;
  if (targetAddress.city && targetAddress.city === candidateAddress.city) score += 22;
  score += similarityPoints(target.purchasePrice, candidate.purchasePrice, 28);
  score += similarityPoints(target.afterRepairValue, candidate.afterRepairValue, 12);
  score += similarityPoints(target.rehabBudgetTotal, candidate.rehabBudgetTotal, 8);
  score += getStatusPoints(candidate.status);
  score += getRecencyPoints(candidate);

  return Math.round(Math.min(100, score));
}

function buildInternalComps(loan: LoanDoc, loans: LoanDoc[], fetchedAt: number): PropertyCompInput[] {
  return loans
    .filter((candidate) => candidate._id !== loan._id)
    .filter((candidate) => candidate.propertyAddress.trim().length > 0)
    .filter((candidate) => candidate.purchasePrice > 0)
    .filter((candidate) => isComparableStatus(candidate.status))
    .map((candidate) => ({
      candidate,
      score: scoreComparableLoan(loan, candidate),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_INTERNAL_COMPS)
    .map(({ candidate, score }) => ({
      loanId: loan._id,
      sourceLoanId: candidate._id,
      address: candidate.propertyAddress,
      salePrice: candidate.purchasePrice,
      saleDate: candidate.closeDate ?? formatUsDate(new Date(candidate._creationTime)),
      ...(candidate.afterRepairValue !== undefined ? { afterRepairValue: candidate.afterRepairValue } : {}),
      ...(candidate.rehabBudgetTotal !== undefined ? { rehabBudgetTotal: candidate.rehabBudgetTotal } : {}),
      loanAmount: candidate.loanAmount,
      similarityScore: score,
      fetchedAt,
      source: "internal_loan",
    }));
}

export const prepareCompsFetch = internalQuery({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");

    const loans = await ctx.db.query("loans").take(1000);
    const fetchedAt = Date.now();
    const internalComps = buildInternalComps(loan, loans, fetchedAt);

    return {
      adminId: admin._id,
      adminName: admin.displayName,
      fetchedAt,
      internalComps,
      loan: {
        _id: loan._id,
        propertyAddress: loan.propertyAddress,
      },
    };
  },
});

export const persistFetchedComps = internalMutation({
  args: {
    loanId: v.id("loans"),
    adminId: v.id("userProfiles"),
    adminName: v.string(),
    propertyAddress: v.string(),
    internalComps: v.array(propertyCompInputValidator),
  },
  handler: async (ctx, args) => {
    const existingComps = await ctx.db
      .query("propertyComps")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .take(100);
    for (const comp of existingComps) {
      await ctx.db.delete(comp._id);
    }

    const existingSummaries = await ctx.db
      .query("propertyCompSummaries")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .take(20);
    for (const summary of existingSummaries) {
      await ctx.db.delete(summary._id);
    }

    for (const comp of args.internalComps) {
      await ctx.db.insert("propertyComps", comp);
    }

    const totalCount = args.internalComps.length;
    await ctx.runMutation(internal.activityLog.log, {
      userId: args.adminId,
      userName: args.adminName,
      action: "comps.fetch",
      entityType: "loan",
      entityId: args.loanId,
      details: `Refreshed ${totalCount} internal property comps for ${args.propertyAddress}`,
    });

    return {
      internalCount: args.internalComps.length,
      totalCount,
    };
  },
});

export const fetchComps = action({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const prepared: {
      adminId: Id<"userProfiles">;
      adminName: string;
      fetchedAt: number;
      internalComps: PropertyCompInput[];
      loan: { _id: Id<"loans">; propertyAddress: string };
    } = await ctx.runQuery(internal.comps.prepareCompsFetch, { loanId: args.loanId });

    const result: {
      internalCount: number;
      totalCount: number;
    } = await ctx.runMutation(internal.comps.persistFetchedComps, {
      loanId: args.loanId,
      adminId: prepared.adminId,
      adminName: prepared.adminName,
      propertyAddress: prepared.loan.propertyAddress,
      internalComps: prepared.internalComps,
    });

    return result;
  },
});
