import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./lib/auth";
import { DEFAULT_INTEREST_RATE } from "./lib/constants";
import {
  DEFAULT_INTEREST_RATE_SETTING_KEY,
  getDefaultInterestRate,
  getDefaultInterestRateSetting,
  MAX_DEFAULT_INTEREST_RATE,
  MIN_DEFAULT_INTEREST_RATE,
  normalizeDefaultInterestRate,
} from "./lib/settings";

export const getLoanDefaults = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);

    return {
      defaultInterestRate: await getDefaultInterestRate(ctx),
    };
  },
});

export const getAdminSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const setting = await getDefaultInterestRateSetting(ctx);
    return {
      defaultInterestRate: setting?.value ?? DEFAULT_INTEREST_RATE,
      defaultInterestRateFallback: DEFAULT_INTEREST_RATE,
      defaultInterestRateConfigured: setting !== null,
      defaultInterestRateUpdatedAt: setting?.updatedAt ?? null,
      minDefaultInterestRate: MIN_DEFAULT_INTEREST_RATE,
      maxDefaultInterestRate: MAX_DEFAULT_INTEREST_RATE,
    };
  },
});

export const updateDefaultInterestRate = mutation({
  args: {
    defaultInterestRate: v.number(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const defaultInterestRate = normalizeDefaultInterestRate(args.defaultInterestRate);
    const now = Date.now();
    const existing = await getDefaultInterestRateSetting(ctx);

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: defaultInterestRate,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appSettings", {
        key: DEFAULT_INTEREST_RATE_SETTING_KEY,
        value: defaultInterestRate,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "settings.updateDefaultInterestRate",
      entityType: "system",
      details: `Updated default annual interest rate to ${defaultInterestRate}%`,
    });

    return { defaultInterestRate };
  },
});
