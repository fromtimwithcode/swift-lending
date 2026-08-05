/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createAdmin(role: "admin" | "developer" = "admin") {
  const t = convexTest(schema, modules);
  const { userId, profileId } = await t.run(async (ctx) => {
    const authUserId = await ctx.db.insert("users", {
      email: `${role}@example.com`,
    });
    const userProfileId = await ctx.db.insert("userProfiles", {
      authUserId,
      role,
      displayName: role === "admin" ? "Admin User" : "Developer User",
      email: `${role}@example.com`,
      isActive: true,
    });
    return { userId: authUserId, profileId: userProfileId };
  });
  return { t, admin: t.withIdentity({ subject: userId }), profileId };
}

describe("app configuration API", () => {
  test("requires an authenticated admin-like profile", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.settings.getAdminSettings, {})).rejects.toThrow(
      "Not authenticated"
    );
  });

  test("keeps the previous Settings API readable and writable", async () => {
    const { t, admin, profileId } = await createAdmin();
    const initial = await admin.query(api.settings.getAdminSettings, {});

    expect(initial).toMatchObject({
      defaultInterestRate: 13,
      defaultInterestRateFallback: 13,
      defaultInterestRateConfigured: false,
      defaultInterestRateUpdatedAt: null,
      minDefaultInterestRate: 0,
      maxDefaultInterestRate: 100,
    });

    const result = await admin.mutation(
      api.settings.updateDefaultInterestRate,
      { defaultInterestRate: 14.125 }
    );
    expect(result).toEqual({ defaultInterestRate: 14.13 });

    const settings = await admin.query(api.settings.getAdminSettings, {});
    expect(settings).toMatchObject({
      version: 1,
      defaultInterestRate: 14.13,
      defaultInterestRateConfigured: true,
    });
    expect(settings.configuration).toEqual({
      ...initial.configuration,
      loanDefaults: {
        ...initial.configuration.loanDefaults,
        annualInterestRate: 14.13,
      },
    });

    const state = await t.run(async (ctx) => {
      const legacyInterestRate = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "defaultInterestRate"))
        .unique();
      const activity = await ctx.db
        .query("activityLog")
        .withIndex("by_action", (q) =>
          q.eq("action", "settings.updateDefaultInterestRate")
        )
        .unique();
      const history = await ctx.db
        .query("appConfigurationHistory")
        .withIndex("by_version", (q) => q.eq("version", 1))
        .unique();
      return { legacyInterestRate, activity, history };
    });
    expect(state.legacyInterestRate).toMatchObject({
      value: 14.13,
      updatedBy: profileId,
    });
    expect(state.activity?.details).toContain("14.13%");
    expect(state.history?.changedKeys).toEqual([
      "loanDefaults.annualInterestRate",
    ]);
  });

  test("validates rates written through the previous Settings API", async () => {
    const { admin } = await createAdmin();
    await expect(
      admin.mutation(api.settings.updateDefaultInterestRate, {
        defaultInterestRate: 100.01,
      })
    ).rejects.toThrow("must be between 0% and 100%");
  });

  test("previews and atomically publishes a versioned configuration", async () => {
    const { t, admin, profileId } = await createAdmin();
    const initial = await admin.query(api.settings.getAdminSettings, {});
    const existingLoanId = await t.run(async (ctx) =>
      await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Existing Borrower",
        entityName: "Existing LLC",
        propertyAddress: "123 Existing St, Austin, TX",
        purchasePrice: 100_000,
        loanAmount: 100_000,
        maturityDate: "12/31/2026",
        terms: "Existing signed terms",
        interestRate: 11,
        monthlyPayment: 916.67,
        paymentDueDay: 5,
        pointsEarned: 2_000,
        pointsPercentage: 2,
        loanTermMonths: 9,
        configurationVersion: 0,
        status: "funded",
        createdBy: profileId,
      })
    );
    const proposed = {
      ...initial.configuration,
      loanDefaults: {
        ...initial.configuration.loanDefaults,
        annualInterestRate: 14.25,
      },
    };

    const preview = await admin.query(api.settings.previewConfigurationChange, {
      configuration: proposed,
    });
    expect(preview.changes).toMatchObject([
      {
        key: "loanDefaults.annualInterestRate",
        effect: "new_loans",
        beforeDisplay: "13%",
        afterDisplay: "14.25%",
      },
    ]);
    expect(preview.protectedRecords).toContain("Recorded payments and historical reporting");

    const result = await admin.mutation(api.settings.updateAppConfiguration, {
      configuration: proposed,
      expectedVersion: initial.version,
      reason: "Quarterly lending policy review",
    });
    expect(result.version).toBe(1);

    const state = await t.run(async (ctx) => {
      const configurationRecord = await ctx.db
        .query("appConfiguration")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique();
      const history = await ctx.db
        .query("appConfigurationHistory")
        .withIndex("by_version", (q) => q.eq("version", 1))
        .unique();
      const activity = await ctx.db
        .query("activityLog")
        .withIndex("by_action", (q) => q.eq("action", "settings.updateAppConfiguration"))
        .unique();
      const legacyInterestRate = await ctx.db
        .query("appSettings")
        .withIndex("by_key", (q) => q.eq("key", "defaultInterestRate"))
        .unique();
      const existingLoan = await ctx.db.get(existingLoanId);
      return { configurationRecord, history, activity, legacyInterestRate, existingLoan };
    });
    expect(state.configurationRecord?.configuration.loanDefaults.annualInterestRate).toBe(14.25);
    expect(state.history?.reason).toBe("Quarterly lending policy review");
    expect(state.activity?.details).toContain("version 1");
    expect(state.legacyInterestRate).toMatchObject({
      value: 14.25,
      updatedBy: profileId,
    });
    expect(state.existingLoan).toMatchObject({
      interestRate: 11,
      paymentDueDay: 5,
      pointsEarned: 2_000,
      pointsPercentage: 2,
      loanTermMonths: 9,
      maturityDate: "12/31/2026",
      configurationVersion: 0,
    });
  });

  test("rejects a stale admin write", async () => {
    const { admin } = await createAdmin();
    const initial = await admin.query(api.settings.getAdminSettings, {});
    const proposed = {
      ...initial.configuration,
      operations: {
        ...initial.configuration.operations,
        paymentReminderWindowDays: 10,
      },
    };

    await expect(
      admin.mutation(api.settings.updateAppConfiguration, {
        configuration: proposed,
        expectedVersion: 9,
      })
    ).rejects.toThrow("Configuration changed since you opened this page");
  });

  test("versions comparable policy independently from unrelated settings", async () => {
    const { t, admin } = await createAdmin();
    const initial = await admin.query(api.settings.getAdminSettings, {});
    const comparableChange = {
      ...initial.configuration,
      comparables: {
        ...initial.configuration.comparables,
        sameState: initial.configuration.comparables.sameState + 1,
      },
    };
    await admin.mutation(api.settings.updateAppConfiguration, {
      configuration: comparableChange,
      expectedVersion: 0,
    });

    const operationalChange = {
      ...comparableChange,
      operations: {
        ...comparableChange.operations,
        paymentReminderWindowDays: 12,
      },
    };
    await admin.mutation(api.settings.updateAppConfiguration, {
      configuration: operationalChange,
      expectedVersion: 1,
    });

    const state = await t.run(async (ctx) => {
      const configuration = await ctx.db
        .query("appConfiguration")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique();
      const job = await ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique();
      return { configuration, job };
    });
    expect(state.configuration).toMatchObject({
      version: 2,
      comparablesVersion: 1,
    });
    expect(state.job?.configurationVersion).toBe(1);
  });

  test("allows an admin to retry a failed comparable rebuild", async () => {
    const { t, admin } = await createAdmin();
    const initial = await admin.query(api.settings.getAdminSettings, {});
    await admin.mutation(api.settings.updateAppConfiguration, {
      expectedVersion: initial.version,
      configuration: {
        ...initial.configuration,
        comparables: {
          ...initial.configuration.comparables,
          sameCity: initial.configuration.comparables.sameCity + 1,
        },
      },
    });
    await t.run(async (ctx) => {
      const job = await ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique();
      if (!job) throw new Error("Expected comparable rebuild job");
      await ctx.db.patch(job._id, {
        status: "failed",
        error: "Temporary rebuild error",
        cursor: "retry-cursor",
      });
    });

    await admin.mutation(api.comps.retryComparableRebuild, {});
    const job = await t.run(async (ctx) =>
      await ctx.db
        .query("configurationJobs")
        .withIndex("by_type", (q) => q.eq("type", "rebuild_comparables"))
        .unique()
    );
    expect(job).toMatchObject({
      status: "queued",
      cursor: "retry-cursor",
    });
    expect(job?.error).toBeUndefined();
  });

  test("allows the developer role to manage configuration", async () => {
    const { admin } = await createAdmin("developer");
    const settings = await admin.query(api.settings.getAdminSettings, {});
    expect(settings.version).toBe(0);
  });
});
