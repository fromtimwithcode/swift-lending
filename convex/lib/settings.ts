import { ConvexError } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  APP_CONFIGURATION_SCOPE,
  DEFAULT_APP_CONFIGURATION,
  normalizeAppConfiguration,
  type AppConfiguration,
} from "./appConfiguration";

export const DEFAULT_INTEREST_RATE_SETTING_KEY = "defaultInterestRate" as const;
export const MIN_DEFAULT_INTEREST_RATE = 0;
export const MAX_DEFAULT_INTEREST_RATE = 100;

type SettingsCtx = QueryCtx | MutationCtx;

/** Kept for compatibility with the previous Settings API. */
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

export async function getAppConfigurationRecord(ctx: SettingsCtx) {
  return await ctx.db
    .query("appConfiguration")
    .withIndex("by_scope", (q) => q.eq("scope", APP_CONFIGURATION_SCOPE))
    .unique();
}

export async function getAppConfigurationState(ctx: SettingsCtx): Promise<{
  configuration: AppConfiguration;
  version: number;
  record: Awaited<ReturnType<typeof getAppConfigurationRecord>>;
}> {
  const record = await getAppConfigurationRecord(ctx);
  if (record) {
    return {
      configuration: record.configuration,
      version: record.version,
      record,
    };
  }

  const legacyInterestRate = await getDefaultInterestRateSetting(ctx);
  const configuration = normalizeAppConfiguration({
    ...DEFAULT_APP_CONFIGURATION,
    loanDefaults: {
      ...DEFAULT_APP_CONFIGURATION.loanDefaults,
      annualInterestRate:
        legacyInterestRate?.value ??
        DEFAULT_APP_CONFIGURATION.loanDefaults.annualInterestRate,
    },
  });
  return { configuration, version: 0, record: null };
}

export async function getAppConfiguration(
  ctx: SettingsCtx
): Promise<AppConfiguration> {
  return (await getAppConfigurationState(ctx)).configuration;
}

export async function getDefaultInterestRate(ctx: SettingsCtx) {
  return (await getAppConfiguration(ctx)).loanDefaults.annualInterestRate;
}
