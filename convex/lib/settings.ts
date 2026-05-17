import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { DEFAULT_INTEREST_RATE } from "./constants";

export const DEFAULT_INTEREST_RATE_SETTING_KEY = "defaultInterestRate" as const;
export const MIN_DEFAULT_INTEREST_RATE = 0;
export const MAX_DEFAULT_INTEREST_RATE = 100;

type SettingsCtx = QueryCtx | MutationCtx;

export function normalizeDefaultInterestRate(value: number) {
  if (!Number.isFinite(value)) {
    throw new ConvexError("Default interest rate must be a finite number");
  }

  if (value < MIN_DEFAULT_INTEREST_RATE || value > MAX_DEFAULT_INTEREST_RATE) {
    throw new ConvexError(
      `Default interest rate must be between ${MIN_DEFAULT_INTEREST_RATE}% and ${MAX_DEFAULT_INTEREST_RATE}%`
    );
  }

  const rounded = Math.round(value * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export async function getDefaultInterestRateSetting(ctx: SettingsCtx) {
  return await ctx.db
    .query("appSettings")
    .withIndex("by_key", (q) => q.eq("key", DEFAULT_INTEREST_RATE_SETTING_KEY))
    .unique();
}

export async function getDefaultInterestRate(ctx: SettingsCtx) {
  const setting = await getDefaultInterestRateSetting(ctx);
  return setting?.value ?? DEFAULT_INTEREST_RATE;
}
