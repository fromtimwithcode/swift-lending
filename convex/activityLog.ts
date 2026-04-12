import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/auth";

const entityTypeValidator = v.union(
  v.literal("loan"),
  v.literal("draw"),
  v.literal("user"),
  v.literal("investment"),
  v.literal("payment"),
  v.literal("document"),
  v.literal("message"),
  v.literal("system")
);

export const log = internalMutation({
  args: {
    userId: v.id("userProfiles"),
    userName: v.string(),
    action: v.string(),
    entityType: entityTypeValidator,
    entityId: v.optional(v.string()),
    details: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("activityLog", args);
  },
});

export const getRecentActivity = query({
  args: {
    entityType: v.optional(entityTypeValidator),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const limit = Math.min(args.limit ?? 100, 500);

    if (args.entityType) {
      return await ctx.db
        .query("activityLog")
        .withIndex("by_entityType", (q) => q.eq("entityType", args.entityType!))
        .order("desc")
        .take(limit);
    }

    return await ctx.db
      .query("activityLog")
      .order("desc")
      .take(limit);
  },
});

export const getActivityForEntity = query({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // Scan recent activity and filter by entityId
    const all = await ctx.db
      .query("activityLog")
      .order("desc")
      .take(500);
    return all.filter((entry) => entry.entityId === args.entityId);
  },
});
