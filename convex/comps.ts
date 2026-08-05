import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";
import type { AppConfiguration } from "./lib/appConfiguration";
import { getAppConfigurationRecord, getAppConfigurationState } from "./lib/settings";

const COMPARABLE_STATUSES = ["closed", "funded", "sent_to_title"] as const;

type LoanDoc = Doc<"loans">;
export type PropertyCompInput = {
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
  configurationVersion?: number;
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
  configurationVersion: v.optional(v.number()),
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
    const internalComps = comps.filter((comp) => comp.source === "internal_loan");
    if (internalComps.length === 0) return [];

    return internalComps;
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

type ComparableRules = AppConfiguration["comparables"];

function similarityPoints(
  targetValue: number | undefined,
  candidateValue: number | undefined,
  maxPoints: number,
  rules: ComparableRules
) {
  if (!targetValue || !candidateValue) return 0;
  const percentDiff = Math.abs(candidateValue - targetValue) / targetValue;
  return Math.max(
    0,
    maxPoints -
      percentDiff * maxPoints * rules.similarityPenaltyMultiplier
  );
}

function getStatusPoints(status: LoanDoc["status"], rules: ComparableRules) {
  if (status === "closed") return rules.statusClosed;
  if (status === "funded") return rules.statusFunded;
  if (status === "sent_to_title") return rules.statusSentToTitle;
  return 0;
}

function getRecencyPoints(
  candidate: LoanDoc,
  rules: ComparableRules,
  asOfTime: number
) {
  const dateTime = parseUsDateTime(candidate.closeDate) ?? candidate._creationTime;
  const monthsOld = Math.max(0, (asOfTime - dateTime) / (1000 * 60 * 60 * 24 * 30));
  return Math.max(
    0,
    rules.recencyMax - monthsOld * rules.recencyPointsLostPerMonth
  );
}

function scoreComparableLoan(
  target: LoanDoc,
  candidate: LoanDoc,
  rules: ComparableRules,
  asOfTime: number
) {
  const targetAddress = getAddressParts(target.propertyAddress);
  const candidateAddress = getAddressParts(candidate.propertyAddress);

  let score = 0;
  if (targetAddress.state && targetAddress.state === candidateAddress.state) {
    score += rules.sameState;
  }
  if (targetAddress.city && targetAddress.city === candidateAddress.city) {
    score += rules.sameCity;
  }
  score += similarityPoints(
    target.purchasePrice,
    candidate.purchasePrice,
    rules.purchasePrice,
    rules
  );
  score += similarityPoints(
    target.afterRepairValue,
    candidate.afterRepairValue,
    rules.afterRepairValue,
    rules
  );
  score += similarityPoints(
    target.rehabBudgetTotal,
    candidate.rehabBudgetTotal,
    rules.rehabBudget,
    rules
  );
  score += getStatusPoints(candidate.status, rules);
  score += getRecencyPoints(candidate, rules, asOfTime);

  return Math.round(Math.min(rules.maxScore, score));
}

function buildInternalComps(
  loan: LoanDoc,
  loans: LoanDoc[],
  fetchedAt: number,
  rules: ComparableRules,
  configurationVersion: number
): PropertyCompInput[] {
  return loans
    .filter((candidate) => candidate._id !== loan._id)
    .filter((candidate) => candidate.propertyAddress.trim().length > 0)
    .filter((candidate) => candidate.purchasePrice > 0)
    .filter((candidate) => isComparableStatus(candidate.status))
    .map((candidate) => ({
      candidate,
      score: scoreComparableLoan(loan, candidate, rules, fetchedAt),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        String(a.candidate._id).localeCompare(String(b.candidate._id))
    )
    .slice(0, rules.maxResults)
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
      configurationVersion,
      fetchedAt,
      source: "internal_loan",
    }));
}

export function mergeTopComparableCandidates(
  current: PropertyCompInput[],
  next: PropertyCompInput[],
  maxResults: number
) {
  return [...current, ...next]
    .sort(
      (a, b) =>
        (b.similarityScore ?? 0) - (a.similarityScore ?? 0) ||
        String(a.sourceLoanId ?? a.address).localeCompare(
          String(b.sourceLoanId ?? b.address)
        )
    )
    .slice(0, maxResults);
}

export const prepareCompsFetch = internalQuery({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");

    const fetchedAt = Date.now();
    const { configuration, record: configurationRecord } =
      await getAppConfigurationState(ctx);

    return {
      adminId: admin._id,
      adminName: admin.displayName,
      fetchedAt,
      configurationVersion: configurationRecord?.comparablesVersion ?? 0,
      maxResults: configuration.comparables.maxResults,
      loan: {
        _id: loan._id,
        propertyAddress: loan.propertyAddress,
      },
    };
  },
});

type ComparableCandidatePage = {
  candidates: PropertyCompInput[];
  isDone: boolean;
  continueCursor?: string;
};

export const getComparableCandidatePage = internalQuery({
  args: {
    loanId: v.id("loans"),
    configurationVersion: v.number(),
    fetchedAt: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ComparableCandidatePage> => {
    const [loan, configurationRecord] = await Promise.all([
      ctx.db.get(args.loanId),
      getAppConfigurationRecord(ctx),
    ]);
    if (!loan) throw new ConvexError("Loan not found");
    if (
      (configurationRecord?.comparablesVersion ?? 0) !==
      args.configurationVersion
    ) {
      throw new ConvexError("Comparable configuration changed during refresh");
    }

    const rules = configurationRecord?.configuration.comparables ??
      (await getAppConfigurationState(ctx)).configuration.comparables;
    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: 100, cursor: args.cursor ?? null });

    return {
      candidates: buildInternalComps(
        loan,
        results.page,
        args.fetchedAt,
        rules,
        args.configurationVersion
      ),
      isDone: results.isDone,
      continueCursor: results.isDone ? undefined : results.continueCursor,
    };
  },
});

async function collectInternalComps(
  ctx: ActionCtx,
  args: {
    loanId: Id<"loans">;
    configurationVersion: number;
    fetchedAt: number;
    maxResults: number;
  }
) {
  const { maxResults, ...queryArgs } = args;
  let cursor: string | undefined;
  let candidates: PropertyCompInput[] = [];

  while (true) {
    const page: ComparableCandidatePage = await ctx.runQuery(
      internal.comps.getComparableCandidatePage,
      { ...queryArgs, cursor }
    );
    candidates = mergeTopComparableCandidates(
      candidates,
      page.candidates,
      maxResults
    );
    if (page.isDone) return candidates;
    cursor = page.continueCursor;
  }
}

export const persistFetchedComps = internalMutation({
  args: {
    loanId: v.id("loans"),
    adminId: v.id("userProfiles"),
    adminName: v.string(),
    propertyAddress: v.string(),
    configurationVersion: v.number(),
    internalComps: v.array(propertyCompInputValidator),
  },
  handler: async (ctx, args) => {
    const configurationRecord = await getAppConfigurationRecord(ctx);
    if (
      (configurationRecord?.comparablesVersion ?? 0) !==
      args.configurationVersion
    ) {
      throw new ConvexError(
        "Comparable configuration changed during refresh. Please refresh again."
      );
    }

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
      configurationVersion: number;
      maxResults: number;
      loan: { _id: Id<"loans">; propertyAddress: string };
    } = await ctx.runQuery(internal.comps.prepareCompsFetch, { loanId: args.loanId });
    const internalComps = await collectInternalComps(ctx, {
      loanId: args.loanId,
      configurationVersion: prepared.configurationVersion,
      fetchedAt: prepared.fetchedAt,
      maxResults: prepared.maxResults,
    });

    const result: {
      internalCount: number;
      totalCount: number;
    } = await ctx.runMutation(internal.comps.persistFetchedComps, {
      loanId: args.loanId,
      adminId: prepared.adminId,
      adminName: prepared.adminName,
      propertyAddress: prepared.loan.propertyAddress,
      configurationVersion: prepared.configurationVersion,
      internalComps,
    });

    return result;
  },
});

type ComparableRebuildTarget =
  | { status: "superseded" }
  | {
      status: "ready";
      loanId?: Id<"loans">;
      shouldRebuild: boolean;
      fetchedAt: number;
      maxResults: number;
      isDone: boolean;
      continueCursor?: string;
    };

export const prepareComparableRebuildTarget = internalQuery({
  args: {
    configurationVersion: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ComparableRebuildTarget> => {
    const [configurationRecord, job] = await Promise.all([
      getAppConfigurationRecord(ctx),
      ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique(),
    ]);
    if (
      !configurationRecord ||
      (configurationRecord.comparablesVersion ?? 0) !==
        args.configurationVersion ||
      !job ||
      job.configurationVersion !== args.configurationVersion ||
      !["queued", "running"].includes(job.status)
    ) {
      return { status: "superseded" as const };
    }

    const results = await ctx.db
      .query("loans")
      .paginate({ numItems: 1, cursor: args.cursor ?? null });
    const loan = results.page[0];
    const existing = loan
      ? await ctx.db
        .query("propertyComps")
        .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
        .take(100)
      : [];

    return {
      status: "ready" as const,
      loanId: loan?._id,
      shouldRebuild: existing.some((comp) => comp.source === "internal_loan"),
      fetchedAt: Date.now(),
      maxResults: configurationRecord.configuration.comparables.maxResults,
      isDone: results.isDone,
      continueCursor: results.isDone ? undefined : results.continueCursor,
    };
  },
});

export const finishComparableRebuildTarget = internalMutation({
  args: {
    configurationVersion: v.number(),
    loanId: v.optional(v.id("loans")),
    shouldRebuild: v.boolean(),
    internalComps: v.array(propertyCompInputValidator),
    isDone: v.boolean(),
    continueCursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [configurationRecord, job] = await Promise.all([
      getAppConfigurationRecord(ctx),
      ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique(),
    ]);
    if (
      !configurationRecord ||
      (configurationRecord.comparablesVersion ?? 0) !==
        args.configurationVersion ||
      !job ||
      job.configurationVersion !== args.configurationVersion
    ) {
      return { status: "superseded" as const };
    }

    if (args.loanId && args.shouldRebuild) {
      const existing = await ctx.db
        .query("propertyComps")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId!))
        .take(100);
      for (const comp of existing) {
        if (comp.source === "internal_loan") await ctx.db.delete(comp._id);
      }
      for (const comp of args.internalComps) await ctx.db.insert("propertyComps", comp);
    }

    const now = Date.now();
    const processedLoans = job.processedLoans + (args.loanId ? 1 : 0);
    if (args.isDone) {
      await ctx.db.patch(job._id, {
        status: "completed",
        processedLoans,
        updatedAt: now,
        completedAt: now,
        error: undefined,
        cursor: undefined,
      });
      return { status: "completed" as const, processedLoans };
    }

    await ctx.db.patch(job._id, {
      status: "running",
      processedLoans,
      updatedAt: now,
      error: undefined,
      cursor: args.continueCursor,
    });
    await ctx.scheduler.runAfter(0, internal.comps.rebuildInternalComparables, {
      configurationVersion: args.configurationVersion,
      cursor: args.continueCursor,
    });
    return { status: "running" as const, processedLoans };
  },
});

export const markComparableRebuildFailed = internalMutation({
  args: {
    configurationVersion: v.number(),
    cursor: v.optional(v.string()),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("configurationJobs")
      .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
      .unique();
    if (!job || job.configurationVersion !== args.configurationVersion) {
      return { status: "superseded" as const };
    }
    await ctx.db.patch(job._id, {
      status: "failed",
      error: args.error.slice(0, 500),
      cursor: args.cursor,
      updatedAt: Date.now(),
    });
    return { status: "failed" as const };
  },
});

export const rebuildInternalComparables = internalAction({
  args: {
    configurationVersion: v.number(),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    status: "superseded" | "running" | "completed" | "failed";
    processedLoans?: number;
    error?: string;
  }> => {
    try {
      const target: ComparableRebuildTarget = await ctx.runQuery(
        internal.comps.prepareComparableRebuildTarget,
        args
      );
      if (target.status === "superseded") return target;

      const internalComps =
        target.loanId && target.shouldRebuild
          ? await collectInternalComps(ctx, {
              loanId: target.loanId,
              configurationVersion: args.configurationVersion,
              fetchedAt: target.fetchedAt,
              maxResults: target.maxResults,
            })
          : [];

      return await ctx.runMutation(internal.comps.finishComparableRebuildTarget, {
        configurationVersion: args.configurationVersion,
        loanId: target.loanId,
        shouldRebuild: target.shouldRebuild,
        internalComps,
        isDone: target.isDone,
        continueCursor: target.continueCursor,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Comparable rebuild failed";
      await ctx.runMutation(internal.comps.markComparableRebuildFailed, {
        configurationVersion: args.configurationVersion,
        cursor: args.cursor,
        error: message,
      });
      return { status: "failed" as const, error: message };
    }
  },
});

export const retryComparableRebuild = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const [configurationRecord, job] = await Promise.all([
      getAppConfigurationRecord(ctx),
      ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique(),
    ]);
    if (!job || job.status !== "failed") {
      throw new ConvexError("There is no failed comparable rebuild to retry");
    }
    if (
      !configurationRecord ||
      (configurationRecord.comparablesVersion ?? 0) !== job.configurationVersion
    ) {
      throw new ConvexError("This comparable rebuild has been superseded");
    }

    await ctx.db.patch(job._id, {
      status: "queued",
      error: undefined,
      updatedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.comps.rebuildInternalComparables, {
      configurationVersion: job.configurationVersion,
      cursor: job.cursor,
    });
    return { status: "queued" as const };
  },
});
