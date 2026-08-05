import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin, requireUser } from "./lib/auth";
import {
  APP_CONFIGURATION_SCOPE,
  appConfigurationValidator,
  appConfigurationsEqual,
  normalizeAppConfiguration,
  type AppConfiguration,
} from "./lib/appConfiguration";
import {
  DEFAULT_INTEREST_RATE_SETTING_KEY,
  getAppConfiguration,
  getAppConfigurationRecord,
  getAppConfigurationState,
  getDefaultInterestRateSetting,
  MAX_DEFAULT_INTEREST_RATE,
  MIN_DEFAULT_INTEREST_RATE,
  normalizeDefaultInterestRate,
} from "./lib/settings";
import { DEFAULT_INTEREST_RATE } from "./lib/constants";

type ChangeEffect = "new_loans" | "immediate" | "rebuild";
type ConfigurationPath =
  | `loanDefaults.${keyof AppConfiguration["loanDefaults"]}`
  | `operations.${keyof AppConfiguration["operations"]}`
  | `comparables.${keyof AppConfiguration["comparables"]}`;

interface ChangeDefinition {
  key: ConfigurationPath;
  label: string;
  effect: ChangeEffect;
  unit: "percent" | "day" | "days" | "months" | "points" | "count" | "multiplier";
  surfaces: string[];
  read: (configuration: AppConfiguration) => number;
}

const COMPARABLE_SURFACES = [
  "Internal comparable-property rankings",
  "Comparable results shown on loan reviews",
  "Calculation Guide",
];

const CHANGE_DEFINITIONS: ChangeDefinition[] = [
  {
    key: "loanDefaults.annualInterestRate",
    label: "Default annual interest rate",
    effect: "new_loans",
    unit: "percent",
    surfaces: [
      "Borrower loan estimates and submitted applications",
      "Admin new-loan interest defaults",
      "Calculation Guide",
    ],
    read: (c) => c.loanDefaults.annualInterestRate,
  },
  {
    key: "loanDefaults.originationPointsPercentage",
    label: "Origination points",
    effect: "new_loans",
    unit: "percent",
    surfaces: [
      "Borrower origination estimates and submitted applications",
      "Admin new-loan points calculations",
      "Calculation Guide",
    ],
    read: (c) => c.loanDefaults.originationPointsPercentage,
  },
  {
    key: "loanDefaults.paymentDueDay",
    label: "Default payment due day",
    effect: "new_loans",
    unit: "day",
    surfaces: [
      "Payment schedules created for new borrower applications",
      "Admin new-loan due-day defaults",
      "Calculation Guide",
    ],
    read: (c) => c.loanDefaults.paymentDueDay,
  },
  {
    key: "loanDefaults.loanTermMonths",
    label: "Standard loan term",
    effect: "new_loans",
    unit: "months",
    surfaces: [
      "New-loan maturity suggestions and policy snapshots",
      "Calculation Guide",
    ],
    read: (c) => c.loanDefaults.loanTermMonths,
  },
  {
    key: "operations.interestChargeWindowDays",
    label: "Interest charge preparation window",
    effect: "immediate",
    unit: "days",
    surfaces: ["Scheduled charge preparation", "Calculation Guide"],
    read: (c) => c.operations.interestChargeWindowDays,
  },
  {
    key: "operations.paymentReminderWindowDays",
    label: "Payment reminder window",
    effect: "immediate",
    unit: "days",
    surfaces: [
      "Admin and borrower payment reminders",
      "Payment reminder notifications",
      "Calculation Guide",
    ],
    read: (c) => c.operations.paymentReminderWindowDays,
  },
  ...([
    ["maxResults", "Maximum comparable results", "count"],
    ["sameState", "Same-state weight", "points"],
    ["sameCity", "Same-city weight", "points"],
    ["purchasePrice", "Purchase-price weight", "points"],
    ["afterRepairValue", "After-repair-value weight", "points"],
    ["rehabBudget", "Rehab-budget weight", "points"],
    ["statusClosed", "Closed-status weight", "points"],
    ["statusFunded", "Funded-status weight", "points"],
    ["statusSentToTitle", "Sent-to-title status weight", "points"],
    ["recencyMax", "Maximum recency weight", "points"],
    ["recencyPointsLostPerMonth", "Monthly recency reduction", "points"],
    ["similarityPenaltyMultiplier", "Similarity penalty multiplier", "multiplier"],
    ["maxScore", "Maximum comparable score", "points"],
  ] as const).map(([field, label, unit]) => ({
    key: `comparables.${field}` as ConfigurationPath,
    label,
    effect: "rebuild" as const,
    unit,
    surfaces: COMPARABLE_SURFACES,
    read: (configuration: AppConfiguration) => configuration.comparables[field],
  })),
];

function formatValue(value: number, unit: ChangeDefinition["unit"]) {
  if (unit === "percent") return `${value}%`;
  if (unit === "day") return `Day ${value}`;
  if (unit === "days") return `${value} day${value === 1 ? "" : "s"}`;
  if (unit === "months") return `${value} month${value === 1 ? "" : "s"}`;
  if (unit === "points") return `${value} point${value === 1 ? "" : "s"}`;
  if (unit === "multiplier") return `${value}×`;
  return String(value);
}

function getConfigurationChanges(
  before: AppConfiguration,
  after: AppConfiguration
) {
  return CHANGE_DEFINITIONS.flatMap((definition) => {
    const previousValue = definition.read(before);
    const nextValue = definition.read(after);
    if (Object.is(previousValue, nextValue)) return [];
    return [
      {
        key: definition.key,
        label: definition.label,
        effect: definition.effect,
        before: previousValue,
        after: nextValue,
        beforeDisplay: formatValue(previousValue, definition.unit),
        afterDisplay: formatValue(nextValue, definition.unit),
        surfaces: definition.surfaces,
      },
    ];
  });
}

function buildImpactPreview(
  before: AppConfiguration,
  proposed: AppConfiguration
) {
  const after = normalizeAppConfiguration(proposed);
  const changes = getConfigurationChanges(before, after);
  const affectedSurfaces = [...new Set(changes.flatMap((change) => change.surfaces))];

  return {
    configuration: after,
    hasChanges: changes.length > 0,
    changes,
    affectedSurfaces,
    affectsNewLoans: changes.some((change) => change.effect === "new_loans"),
    hasImmediateOperationalImpact: changes.some(
      (change) => change.effect === "immediate"
    ),
    rebuildsComparables: changes.some((change) => change.effect === "rebuild"),
    requiresAcknowledgement: changes.length > 0,
    protectedRecords: [
      "Existing loan rates, points, due days, and maturity dates",
      "Paid or waived charges",
      "Recorded payments and historical reporting",
    ],
  };
}

export const getLoanDefaults = query({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    const { configuration, version } = await getAppConfigurationState(ctx);

    return {
      defaultInterestRate: configuration.loanDefaults.annualInterestRate,
      defaultPointsPercentage:
        configuration.loanDefaults.originationPointsPercentage,
      defaultPaymentDueDay: configuration.loanDefaults.paymentDueDay,
      defaultLoanTermMonths: configuration.loanDefaults.loanTermMonths,
      configurationVersion: version,
    };
  },
});

export const getAdminSettings = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const { configuration, version, record } =
      await getAppConfigurationState(ctx);
    const [updatedBy, comparableRebuild, legacyInterestRate] = await Promise.all([
      record?.updatedBy ? ctx.db.get(record.updatedBy) : null,
      ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique(),
      getDefaultInterestRateSetting(ctx),
    ]);

    const defaultInterestRate = configuration.loanDefaults.annualInterestRate;

    return {
      configuration,
      version,
      comparablesVersion: record?.comparablesVersion ?? 0,
      configured: record !== null,
      updatedAt: record?.updatedAt ?? null,
      updatedByName: updatedBy?.displayName ?? null,
      comparableRebuild,
      // Legacy fields keep the previous Settings client usable during rollout
      // and while a frontend-only rollback is active.
      defaultInterestRate,
      defaultInterestRateFallback: DEFAULT_INTEREST_RATE,
      defaultInterestRateConfigured:
        record !== null || legacyInterestRate !== null,
      defaultInterestRateUpdatedAt:
        record?.updatedAt ?? legacyInterestRate?.updatedAt ?? null,
      minDefaultInterestRate: MIN_DEFAULT_INTEREST_RATE,
      maxDefaultInterestRate: MAX_DEFAULT_INTEREST_RATE,
    };
  },
});

export const previewConfigurationChange = query({
  args: { configuration: appConfigurationValidator },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    return buildImpactPreview(
      await getAppConfiguration(ctx),
      args.configuration
    );
  },
});

export const getConfigurationHistory = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const history = await ctx.db
      .query("appConfigurationHistory")
      .withIndex("by_changedAt")
      .order("desc")
      .take(20);

    return await Promise.all(
      history.map(async (entry) => ({
        ...entry,
        changedByName:
          (await ctx.db.get(entry.changedBy))?.displayName ?? "Unknown admin",
      }))
    );
  },
});

async function applyAppConfiguration(
  ctx: MutationCtx,
  admin: Doc<"userProfiles">,
  args: {
    configuration: AppConfiguration;
    expectedVersion: number;
    reason?: string;
    activityAction?: string;
    activityDetails?: string;
  }
) {
    const record = await getAppConfigurationRecord(ctx);
    const currentVersion = record?.version ?? 0;
    if (args.expectedVersion !== currentVersion) {
      throw new ConvexError(
        "Configuration changed since you opened this page. Reload the latest settings before applying your changes."
      );
    }

    const beforeConfiguration =
      record?.configuration ?? (await getAppConfiguration(ctx));
    const preview = buildImpactPreview(beforeConfiguration, args.configuration);
    if (
      !preview.hasChanges ||
      appConfigurationsEqual(beforeConfiguration, preview.configuration)
    ) {
      return {
        configuration: beforeConfiguration,
        version: currentVersion,
        updatedAt: record?.updatedAt ?? null,
        changedKeys: [] as string[],
      };
    }

    const reason = args.reason?.trim() || undefined;
    if (reason && reason.length > 500) {
      throw new ConvexError("Change reason must be 500 characters or fewer");
    }

    const now = Date.now();
    const version = currentVersion + 1;
    const comparablesVersion =
      (record?.comparablesVersion ?? 0) + (preview.rebuildsComparables ? 1 : 0);
    if (record) {
      await ctx.db.patch(record._id, {
        version,
        comparablesVersion,
        configuration: preview.configuration,
        updatedAt: now,
        updatedBy: admin._id,
      });
    } else {
      await ctx.db.insert("appConfiguration", {
        scope: APP_CONFIGURATION_SCOPE,
        version,
        comparablesVersion,
        configuration: preview.configuration,
        updatedAt: now,
        updatedBy: admin._id,
      });
    }

    const legacyInterestRate = await getDefaultInterestRateSetting(ctx);
    const legacyInterestRateUpdate = {
      value: preview.configuration.loanDefaults.annualInterestRate,
      updatedAt: now,
      updatedBy: admin._id,
    };
    if (legacyInterestRate) {
      await ctx.db.patch(legacyInterestRate._id, legacyInterestRateUpdate);
    } else {
      await ctx.db.insert("appSettings", {
        key: DEFAULT_INTEREST_RATE_SETTING_KEY,
        ...legacyInterestRateUpdate,
      });
    }

    const changedKeys = preview.changes.map((change) => change.key);
    await ctx.db.insert("appConfigurationHistory", {
      version,
      beforeConfiguration,
      afterConfiguration: preview.configuration,
      changedKeys,
      reason,
      changedAt: now,
      changedBy: admin._id,
    });

    await ctx.db.insert("activityLog", {
      userId: admin._id,
      userName: admin.displayName,
      action: args.activityAction ?? "settings.updateAppConfiguration",
      entityType: "system",
      details:
        args.activityDetails ??
        `Applied app configuration version ${version}: ${preview.changes
          .map((change) => change.label)
          .join(", ")}`,
      metadata: JSON.stringify({ version, changedKeys, reason }),
    });

    if (preview.rebuildsComparables) {
      const existingJob = await ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique();
      const job = {
        configurationVersion: comparablesVersion,
        status: "queued" as const,
        processedLoans: 0,
        requestedAt: now,
        updatedAt: now,
        completedAt: undefined,
        error: undefined,
        cursor: undefined,
      };
      if (existingJob) await ctx.db.patch(existingJob._id, job);
      else {
        await ctx.db.insert("configurationJobs", {
          type: "rebuild_comparables",
          ...job,
        });
      }

      await ctx.scheduler.runAfter(0, internal.comps.rebuildInternalComparables, {
        configurationVersion: comparablesVersion,
      });
    }

    return {
      configuration: preview.configuration,
      version,
      updatedAt: now,
      changedKeys,
    };
}

export const updateAppConfiguration = mutation({
  args: {
    configuration: appConfigurationValidator,
    expectedVersion: v.number(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    return await applyAppConfiguration(ctx, admin, args);
  },
});

/**
 * Backward-compatible mutation for the previous Settings frontend. It updates
 * the versioned configuration and the legacy appSettings record atomically.
 */
export const updateDefaultInterestRate = mutation({
  args: { defaultInterestRate: v.number() },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const { configuration, version } = await getAppConfigurationState(ctx);
    const defaultInterestRate = normalizeDefaultInterestRate(
      args.defaultInterestRate
    );
    const result = await applyAppConfiguration(ctx, admin, {
      configuration: {
        ...configuration,
        loanDefaults: {
          ...configuration.loanDefaults,
          annualInterestRate: defaultInterestRate,
        },
      },
      expectedVersion: version,
      reason: "Updated through the legacy Settings API",
      activityAction: "settings.updateDefaultInterestRate",
      activityDetails: `Updated default annual interest rate to ${defaultInterestRate}%`,
    });

    return {
      defaultInterestRate: result.configuration.loanDefaults.annualInterestRate,
    };
  },
});
