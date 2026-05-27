import { action, internalMutation, internalQuery, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

const COMPARABLE_STATUSES = ["closed", "funded", "sent_to_title"] as const;
const MAX_INTERNAL_COMPS = 8;
const MAX_RENTCAST_COMPS = 15;
const RENTCAST_VALUE_URL = "https://api.rentcast.io/v1/avm/value";

type LoanDoc = Doc<"loans">;
type PropertyCompInput = {
  loanId: Id<"loans">;
  sourceLoanId?: Id<"loans">;
  externalId?: string;
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
type PropertyCompSummaryInput = {
  loanId: Id<"loans">;
  source: string;
  estimatedValue?: number;
  priceRangeLow?: number;
  priceRangeHigh?: number;
  subjectAddress?: string;
  subjectPropertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  lotSize?: number;
  yearBuilt?: number;
  latitude?: number;
  longitude?: number;
  lastSaleDate?: string;
  lastSalePrice?: number;
  fetchedAt: number;
};

const propertyCompInputValidator = v.object({
  loanId: v.id("loans"),
  sourceLoanId: v.optional(v.id("loans")),
  externalId: v.optional(v.string()),
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

const propertyCompSummaryInputValidator = v.object({
  loanId: v.id("loans"),
  source: v.string(),
  estimatedValue: v.optional(v.number()),
  priceRangeLow: v.optional(v.number()),
  priceRangeHigh: v.optional(v.number()),
  subjectAddress: v.optional(v.string()),
  subjectPropertyType: v.optional(v.string()),
  bedrooms: v.optional(v.number()),
  bathrooms: v.optional(v.number()),
  sqft: v.optional(v.number()),
  lotSize: v.optional(v.number()),
  yearBuilt: v.optional(v.number()),
  latitude: v.optional(v.number()),
  longitude: v.optional(v.number()),
  lastSaleDate: v.optional(v.string()),
  lastSalePrice: v.optional(v.number()),
  fetchedAt: v.number(),
});

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

export const getCompSummaryForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return await ctx.db
      .query("propertyCompSummaries")
      .withIndex("by_loanId_and_fetchedAt", (q) => q.eq("loanId", args.loanId))
      .order("desc")
      .first();
  },
});

function isComparableStatus(status: LoanDoc["status"]) {
  return (COMPARABLE_STATUSES as readonly string[]).includes(status);
}

function formatUsDate(date: Date) {
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function formatRentCastDate(value: string | undefined) {
  if (!value) return undefined;
  const isoDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) return `${isoDate[2]}/${isoDate[3]}/${isoDate[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return formatUsDate(date);
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

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getString(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getNumber(record: Record<string, unknown> | null, key: string) {
  const value = record?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function getSimilarityScore(correlation: number | undefined) {
  if (correlation === undefined) return undefined;
  return Math.max(0, Math.min(100, Math.round(correlation * 100)));
}

function getRentCastApiKey() {
  const trimmed = process.env.RENTCAST_API_KEY?.trim();
  if (!trimmed) return undefined;

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
    return trimmed.slice(1, -1).trim() || undefined;
  }

  return trimmed;
}

function normalizeRentCastComps(
  loanId: Id<"loans">,
  response: Record<string, unknown> | null,
  fetchedAt: number
): PropertyCompInput[] {
  const comparables = Array.isArray(response?.comparables) ? response.comparables : [];
  return comparables
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => item !== null)
    .map((item): PropertyCompInput | null => {
      const address = getString(item, "formattedAddress");
      const price = getNumber(item, "price");
      if (!address || !price) return null;

      const listedDate = formatRentCastDate(getString(item, "listedDate"));
      const removedDate = formatRentCastDate(getString(item, "removedDate"));
      const lastSeenDate = formatRentCastDate(getString(item, "lastSeenDate"));

      return {
        loanId,
        ...(getString(item, "id") ? { externalId: getString(item, "id") } : {}),
        address,
        salePrice: price,
        saleDate: listedDate ?? removedDate ?? lastSeenDate ?? "N/A",
        ...(getNumber(item, "squareFootage") !== undefined ? { sqft: getNumber(item, "squareFootage") } : {}),
        ...(getNumber(item, "bedrooms") !== undefined ? { bedrooms: getNumber(item, "bedrooms") } : {}),
        ...(getNumber(item, "bathrooms") !== undefined ? { bathrooms: getNumber(item, "bathrooms") } : {}),
        ...(getNumber(item, "distance") !== undefined ? { distanceMiles: getNumber(item, "distance") } : {}),
        ...(getNumber(item, "yearBuilt") !== undefined ? { yearBuilt: getNumber(item, "yearBuilt") } : {}),
        ...(getString(item, "propertyType") ? { propertyType: getString(item, "propertyType") } : {}),
        ...(getString(item, "status") ? { listingStatus: getString(item, "status") } : {}),
        ...(getString(item, "listingType") ? { listingType: getString(item, "listingType") } : {}),
        ...(listedDate ? { listedDate } : {}),
        ...(removedDate ? { removedDate } : {}),
        ...(lastSeenDate ? { lastSeenDate } : {}),
        ...(getNumber(item, "daysOnMarket") !== undefined ? { daysOnMarket: getNumber(item, "daysOnMarket") } : {}),
        ...(getNumber(item, "daysOld") !== undefined ? { daysOld: getNumber(item, "daysOld") } : {}),
        ...(getSimilarityScore(getNumber(item, "correlation")) !== undefined
          ? { similarityScore: getSimilarityScore(getNumber(item, "correlation")) }
          : {}),
        fetchedAt,
        source: "rentcast_avm",
      };
    })
    .filter((item): item is PropertyCompInput => item !== null)
    .slice(0, MAX_RENTCAST_COMPS);
}

function normalizeRentCastSummary(
  loanId: Id<"loans">,
  response: Record<string, unknown> | null,
  fetchedAt: number
): PropertyCompSummaryInput | undefined {
  if (!response) return undefined;
  const subject = asRecord(response.subjectProperty);

  return {
    loanId,
    source: "rentcast_avm",
    fetchedAt,
    ...(getNumber(response, "price") !== undefined ? { estimatedValue: getNumber(response, "price") } : {}),
    ...(getNumber(response, "priceRangeLow") !== undefined ? { priceRangeLow: getNumber(response, "priceRangeLow") } : {}),
    ...(getNumber(response, "priceRangeHigh") !== undefined ? { priceRangeHigh: getNumber(response, "priceRangeHigh") } : {}),
    ...(getString(subject, "formattedAddress") ? { subjectAddress: getString(subject, "formattedAddress") } : {}),
    ...(getString(subject, "propertyType") ? { subjectPropertyType: getString(subject, "propertyType") } : {}),
    ...(getNumber(subject, "bedrooms") !== undefined ? { bedrooms: getNumber(subject, "bedrooms") } : {}),
    ...(getNumber(subject, "bathrooms") !== undefined ? { bathrooms: getNumber(subject, "bathrooms") } : {}),
    ...(getNumber(subject, "squareFootage") !== undefined ? { sqft: getNumber(subject, "squareFootage") } : {}),
    ...(getNumber(subject, "lotSize") !== undefined ? { lotSize: getNumber(subject, "lotSize") } : {}),
    ...(getNumber(subject, "yearBuilt") !== undefined ? { yearBuilt: getNumber(subject, "yearBuilt") } : {}),
    ...(getNumber(subject, "latitude") !== undefined ? { latitude: getNumber(subject, "latitude") } : {}),
    ...(getNumber(subject, "longitude") !== undefined ? { longitude: getNumber(subject, "longitude") } : {}),
    ...(formatRentCastDate(getString(subject, "lastSaleDate"))
      ? { lastSaleDate: formatRentCastDate(getString(subject, "lastSaleDate")) }
      : {}),
    ...(getNumber(subject, "lastSalePrice") !== undefined ? { lastSalePrice: getNumber(subject, "lastSalePrice") } : {}),
  };
}

function getRentCastErrorMessage(status: number, body: Record<string, unknown> | null) {
  const message = getString(body, "message");
  const code = getString(body, "error");
  if (status === 400) return message ?? "RentCast could not parse or geocode this property address.";
  if (status === 401) {
    return message
      ? `RentCast authentication or billing error${code ? ` (${code})` : ""}: ${message}`
      : "RentCast API key, billing, or subscription is not configured correctly.";
  }
  if (status === 404) return "No RentCast market comps found for this address.";
  if (status === 429) return "RentCast rate limit reached. Try again shortly.";
  if (status === 500 || status === 504) return "RentCast is temporarily unavailable. Try again shortly.";
  return message ?? "RentCast request failed.";
}

function logRentCastError(status: number, body: Record<string, unknown> | null) {
  console.warn("RentCast comps request failed", {
    status,
    error: getString(body, "error"),
    message: getString(body, "message"),
  });
}

async function fetchRentCastValueEstimate(address: string) {
  const apiKey = getRentCastApiKey();
  if (!apiKey) {
    throw new ConvexError("RENTCAST_API_KEY is not configured");
  }

  const params = new URLSearchParams({
    address,
    maxRadius: "5",
    daysOld: "270",
    compCount: String(MAX_RENTCAST_COMPS),
    lookupSubjectAttributes: "true",
  });
  const response = await fetch(`${RENTCAST_VALUE_URL}?${params.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey,
    },
  });
  const body = asRecord(await response.json().catch(() => null));

  if (!response.ok) {
    logRentCastError(response.status, body);
    const message = getRentCastErrorMessage(response.status, body);
    if (response.status === 400 || response.status === 404) {
      return { warning: message, data: null };
    }
    throw new ConvexError(message);
  }

  return { warning: undefined, data: body };
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
    rentCastComps: v.array(propertyCompInputValidator),
    internalComps: v.array(propertyCompInputValidator),
    summary: v.optional(propertyCompSummaryInputValidator),
    warning: v.optional(v.string()),
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

    for (const comp of [...args.rentCastComps, ...args.internalComps]) {
      await ctx.db.insert("propertyComps", comp);
    }

    if (args.summary) {
      await ctx.db.insert("propertyCompSummaries", args.summary);
    }

    const totalCount = args.rentCastComps.length + args.internalComps.length;
    await ctx.runMutation(internal.activityLog.log, {
      userId: args.adminId,
      userName: args.adminName,
      action: "comps.fetch",
      entityType: "loan",
      entityId: args.loanId,
      details: `Refreshed ${totalCount} property comps for ${args.propertyAddress} (${args.rentCastComps.length} RentCast, ${args.internalComps.length} internal)`,
      ...(args.warning ? { metadata: args.warning } : {}),
    });

    return {
      rentCastCount: args.rentCastComps.length,
      internalCount: args.internalComps.length,
      totalCount,
      ...(args.warning ? { warning: args.warning } : {}),
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

    const rentCast = await fetchRentCastValueEstimate(prepared.loan.propertyAddress);
    const rentCastComps = normalizeRentCastComps(args.loanId, rentCast.data, prepared.fetchedAt);
    const summary = normalizeRentCastSummary(args.loanId, rentCast.data, prepared.fetchedAt);

    const result: {
      rentCastCount: number;
      internalCount: number;
      totalCount: number;
      warning?: string;
    } = await ctx.runMutation(internal.comps.persistFetchedComps, {
      loanId: args.loanId,
      adminId: prepared.adminId,
      adminName: prepared.adminName,
      propertyAddress: prepared.loan.propertyAddress,
      rentCastComps,
      internalComps: prepared.internalComps,
      ...(summary ? { summary } : {}),
      ...(rentCast.warning ? { warning: rentCast.warning } : {}),
    });

    return result;
  },
});
