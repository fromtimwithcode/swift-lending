import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";
import { internal } from "./_generated/api";

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

export const saveComps = internalMutation({
  args: {
    loanId: v.id("loans"),
    comps: v.array(
      v.object({
        address: v.string(),
        salePrice: v.number(),
        saleDate: v.string(),
        sqft: v.number(),
        bedrooms: v.number(),
        bathrooms: v.number(),
        distanceMiles: v.number(),
        yearBuilt: v.number(),
        source: v.string(),
      })
    ),
  },
  handler: async (ctx, args) => {
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found — cannot save comps for non-existent loan");

    for (const comp of args.comps) {
      await ctx.db.insert("propertyComps", {
        loanId: args.loanId,
        ...comp,
      });
    }
  },
});

// Mock street names for generating comp addresses
const STREETS = [
  "Oak St", "Maple Ave", "Cedar Ln", "Pine Dr", "Elm Blvd",
  "Birch Rd", "Walnut Way", "Cherry Ct", "Willow Pl", "Spruce Ter",
];

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export const fetchComps = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);

    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new Error("Loan not found");

    // Delete existing comps for this loan
    const existing = await ctx.db
      .query("propertyComps")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();
    for (const comp of existing) {
      await ctx.db.delete(comp._id);
    }

    const basePrice = loan.purchasePrice;
    const count = randomBetween(3, 5);
    const comps = [];

    for (let i = 0; i < count; i++) {
      const priceFactor = 0.8 + Math.random() * 0.4; // ±20%
      const sqft = randomBetween(1000, 3500);
      const beds = randomBetween(2, 5);
      const baths = randomBetween(1, 3);
      const houseNum = randomBetween(100, 9999);
      const street = STREETS[randomBetween(0, STREETS.length - 1)];
      const year = randomBetween(1950, 2023);
      const saleMonth = randomBetween(1, 12);
      const saleDay = randomBetween(1, 28);
      const saleYear = randomBetween(2024, 2026);

      comps.push({
        address: `${houseNum} ${street}`,
        salePrice: Math.round(basePrice * priceFactor),
        saleDate: `${String(saleMonth).padStart(2, "0")}/${String(saleDay).padStart(2, "0")}/${saleYear}`,
        sqft,
        bedrooms: beds,
        bathrooms: baths,
        distanceMiles: Math.round(Math.random() * 50) / 10, // 0.0 - 5.0 mi
        yearBuilt: year,
        source: "mock",
      });
    }

    await ctx.runMutation(internal.comps.saveComps, {
      loanId: args.loanId,
      comps,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "comps.fetch",
      entityType: "loan",
      entityId: args.loanId,
      details: `Fetched ${comps.length} property comps for ${loan.propertyAddress}`,
    });

    return comps;
  },
});
