import { query, mutation } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

const COMPARABLE_STATUSES = ["closed", "funded", "sent_to_title"] as const;
const MAX_COMPS = 8;

type LoanDoc = Doc<"loans">;

export const getCompsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("propertyComps")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .take(50);
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

export const fetchComps = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");

    const existing = await ctx.db
      .query("propertyComps")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();
    for (const comp of existing) {
      await ctx.db.delete(comp._id);
    }

    const loans = await ctx.db.query("loans").collect();
    const fetchedAt = Date.now();
    const comparableLoans = loans
      .filter((candidate) => candidate._id !== args.loanId)
      .filter((candidate) => candidate.propertyAddress.trim().length > 0)
      .filter((candidate) => candidate.purchasePrice > 0)
      .filter((candidate) => isComparableStatus(candidate.status))
      .map((candidate) => ({
        candidate,
        score: scoreComparableLoan(loan, candidate),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_COMPS);

    const comps = comparableLoans.map(({ candidate, score }) => ({
      loanId: args.loanId,
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

    for (const comp of comps) {
      await ctx.db.insert("propertyComps", comp);
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "comps.fetch",
      entityType: "loan",
      entityId: args.loanId,
      details: `Refreshed ${comps.length} internal property comps for ${loan.propertyAddress}`,
    });

    return comps;
  },
});
