/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("loan configuration snapshot migration", () => {
  test("dry-runs before adding legacy snapshots without changing loan economics", async () => {
    const t = convexTest(schema, modules);
    const loanId = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("userProfiles", {
        role: "admin",
        displayName: "Migration Admin",
        email: "migration@example.com",
        isActive: true,
      });
      return await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Legacy Borrower",
        entityName: "Legacy LLC",
        propertyAddress: "10 Legacy Ave, Dallas, TX",
        purchasePrice: 250_000,
        loanAmount: 250_000,
        maturityDate: "11/30/2026",
        terms: "Legacy terms",
        interestRate: 12,
        monthlyPayment: 2_500,
        pointsEarned: 5_000,
        status: "funded",
        createdBy: profileId,
      });
    });

    const dryRun = await t.mutation(
      internal.migrations.backfillLoanConfigurationSnapshots,
      { dryRun: true }
    );
    expect(dryRun).toMatchObject({ dryRun: true, updated: 0, wouldUpdate: 1 });
    expect(await t.run(async (ctx) => await ctx.db.get(loanId))).toMatchObject({
      interestRate: 12,
      pointsEarned: 5_000,
      maturityDate: "11/30/2026",
    });

    await t.mutation(internal.migrations.backfillLoanConfigurationSnapshots, {});
    const migrated = await t.run(async (ctx) => await ctx.db.get(loanId));
    expect(migrated).toMatchObject({
      paymentDueDay: 1,
      pointsPercentage: 2,
      loanTermMonths: 6,
      configurationVersion: 0,
      interestRate: 12,
      pointsEarned: 5_000,
      maturityDate: "11/30/2026",
    });
  });

  test("preserves legacy points when a later edit submits a stale calculated value", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "edit-admin@example.com" });
      const profileId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Edit Admin",
        email: "edit-admin@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Legacy Borrower",
        entityName: "Legacy LLC",
        propertyAddress: "11 Legacy Ave, Dallas, TX",
        purchasePrice: 250_000,
        loanAmount: 250_000,
        terms: "Legacy terms",
        interestRate: 12,
        monthlyPayment: 2_500,
        pointsEarned: 5_000,
        status: "funded",
        createdBy: profileId,
      });
      return { userId, loanId };
    });

    await t.mutation(internal.migrations.backfillLoanConfigurationSnapshots, {});
    const admin = t.withIdentity({ subject: userId });
    await admin.mutation(api.admin.updateLoan, {
      id: loanId,
      loanAmount: 250_000,
      pointsEarned: 7_500,
      notes: "Unrelated servicing note",
    });

    expect(await t.run(async (ctx) => await ctx.db.get(loanId))).toMatchObject({
      pointsEarned: 5_000,
      pointsPercentage: 2,
      notes: "Unrelated servicing note",
    });
  });
});

describe("funding ledger reconciliation", () => {
  test("audits, dry-runs, applies, and idempotently verifies dated funding", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "ledger-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Ledger Admin",
        email: "ledger-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Ledger Borrower",
        email: "ledger-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Ledger Borrower",
        entityName: "Ledger LLC",
        propertyAddress: "30 Ledger Ave, Dallas, TX",
        purchasePrice: 150_000,
        loanAmount: 200_000,
        closeDate: "01/15/2026",
        maturityDate: "12/31/2026",
        terms: "Ledger terms",
        interestRate: 12,
        monthlyPayment: 1_700,
        pointsEarned: 6_000,
        drawFundsTotal: 50_000,
        drawFundsUsed: 20_000,
        status: "funded",
        createdBy: adminId,
      });
      await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 5_000,
        workDescription: "Recorded funding",
        status: "approved",
        wireDate: "02/01/2026",
        source: "request",
      });
      return { userId, adminId, loanId };
    });

    const auditBefore = await t.query(internal.migrations.auditFundingLedgers, {});
    expect(auditBefore.discrepancies).toMatchObject([
      {
        loanId: fixture.loanId,
        savedTotal: 20_000,
        recordedTotal: 5_000,
        difference: 15_000,
      },
    ]);

    const args = {
      loanId: fixture.loanId,
      verifiedBy: fixture.adminId,
      reason: "Verified against wire confirmations",
      entries: [{ amount: 15_000, wireDate: "02/15/2026" }],
    };
    await expect(
      t.mutation(internal.migrations.reconcileFundingLedger, {
        ...args,
        dryRun: true,
      })
    ).resolves.toMatchObject({ dryRun: true, entryTotal: 15_000 });
    expect(
      await t.run(async (ctx) =>
        (await ctx.db
          .query("drawRequests")
          .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
          .collect()).length
      )
    ).toBe(1);

    await t.mutation(internal.migrations.reconcileFundingLedger, args);
    await expect(
      t.mutation(internal.migrations.reconcileFundingLedger, args)
    ).resolves.toMatchObject({ alreadyReconciled: true });

    const auditAfter = await t.query(internal.migrations.auditFundingLedgers, {});
    expect(auditAfter.discrepancies).toHaveLength(0);
    const statement = await t
      .withIdentity({ subject: fixture.userId })
      .query(api.payoffs.getPayoffStatement, {
        loanId: fixture.loanId,
        goodThroughDate: "10/01/2026",
      });
    expect(statement.principal).toBe(170_000);
  });

  test("migrates a legacy UI balance as opening funding effective at closing", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        email: "legacy-ledger-admin@example.com",
      });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Legacy Ledger Admin",
        email: "legacy-ledger-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Legacy Ledger Borrower",
        email: "legacy-ledger-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Legacy Ledger Borrower",
        entityName: "Legacy Ledger LLC",
        propertyAddress: "31 Ledger Ave, Dallas, TX",
        purchasePrice: 150_000,
        loanAmount: 200_000,
        closeDate: "01/15/2026",
        maturityDate: "12/31/2026",
        terms: "Legacy ledger terms",
        interestRate: 12,
        monthlyPayment: 1_700,
        pointsEarned: 6_000,
        drawFundsTotal: 50_000,
        drawFundsUsed: 20_000,
        status: "funded",
        createdBy: adminId,
      });
      await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 5_000,
        workDescription: "Later recorded funding",
        status: "approved",
        wireDate: "02/01/2026",
        source: "request",
      });
      return { userId, adminId, loanId };
    });

    const args = {
      loanId: fixture.loanId,
      verifiedBy: fixture.adminId,
      reason: "Legacy amount was entered through the original loan form",
    };
    await expect(
      t.mutation(internal.migrations.reconcileLegacyOpeningBalance, {
        ...args,
        dryRun: true,
      })
    ).resolves.toMatchObject({
      dryRun: true,
      entryTotal: 15_000,
      effectiveDate: "01/15/2026",
      recordedTotalAfter: 20_000,
      chargesWillSync: true,
    });

    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("drawRequests")
          .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
          .take(10)
      )
    ).toHaveLength(1);

    await t.mutation(internal.migrations.reconcileLegacyOpeningBalance, args);
    await expect(
      t.mutation(internal.migrations.reconcileLegacyOpeningBalance, args)
    ).resolves.toMatchObject({ alreadyReconciled: true });

    const draws = await t.run(async (ctx) =>
      ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
        .take(10)
    );
    expect(draws).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          amountRequested: 15_000,
          wireDate: "01/15/2026",
          source: "opening_balance",
          status: "approved",
        }),
      ])
    );
    await expect(
      t.query(internal.migrations.auditFundingLedgers, {})
    ).resolves.toMatchObject({ discrepancies: [] });

    const statement = await t
      .withIdentity({ subject: fixture.userId })
      .query(api.payoffs.getPayoffStatement, {
        loanId: fixture.loanId,
        goodThroughDate: "10/01/2026",
      });
    expect(statement.principal).toBe(170_000);
  });

  test("does not regenerate charges while reconciling a returned legacy loan", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const adminId = await ctx.db.insert("userProfiles", {
        role: "admin",
        displayName: "Returned Loan Admin",
        email: "returned-loan-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Returned Loan Borrower",
        email: "returned-loan-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Returned Loan Borrower",
        entityName: "Returned Loan LLC",
        propertyAddress: "32 Ledger Ave, Dallas, TX",
        purchasePrice: 170_000,
        loanAmount: 230_000,
        closeDate: "03/21/2026",
        maturityDate: "09/21/2026",
        terms: "Returned loan terms",
        interestRate: 13,
        monthlyPayment: 2_491.67,
        pointsEarned: 6_900,
        drawFundsTotal: 60_000,
        drawFundsUsed: 60_000,
        returnedAmount: 233_156.24,
        returnedDate: "06/05/2026",
        status: "closed",
        createdBy: adminId,
      });
      return { adminId, loanId };
    });

    await expect(
      t.mutation(internal.migrations.reconcileLegacyOpeningBalance, {
        loanId: fixture.loanId,
        verifiedBy: fixture.adminId,
        reason: "Legacy amount was entered through the original loan form",
      })
    ).resolves.toMatchObject({
      entryTotal: 60_000,
      effectiveDate: "03/21/2026",
      recordedTotalAfter: 60_000,
      chargesWillSync: false,
    });

    const state = await t.run(async (ctx) => ({
      draws: await ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
        .take(10),
      charges: await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
        .take(10),
    }));
    expect(state.draws).toEqual([
      expect.objectContaining({
        amountRequested: 60_000,
        wireDate: "03/21/2026",
        source: "opening_balance",
      }),
    ]);
    expect(state.charges).toHaveLength(0);
  });
});

describe("combined interest charge reconciliation", () => {
  test("dry-runs and idempotently closes only fully funded charge groups", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("userProfiles", {
        role: "admin",
        displayName: "Migration Admin",
        email: "combined-payment@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Combined Payment Borrower",
        entityName: "Combined Payment LLC",
        propertyAddress: "12 Combined Ave, Dallas, TX",
        purchasePrice: 400_000,
        loanAmount: 400_000,
        terms: "Combined payment terms",
        interestRate: 13,
        monthlyPayment: 4_333.33,
        pointsEarned: 12_000,
        status: "funded",
        createdBy: profileId,
      });
      const monthlyChargeId = await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId: profileId,
        type: "monthly_interest",
        amount: 4_253.33,
        principalBasis: 392_615.08,
        interestRate: 13,
        periodStart: "07/01/2026",
        periodEnd: "07/31/2026",
        dueDate: "08/01/2026",
        status: "paid",
        createdBy: profileId,
      });
      const drawChargeId = await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId: profileId,
        type: "draw_proration",
        amount: 80,
        principalBasis: 12_000,
        interestRate: 13,
        periodStart: "07/15/2026",
        periodEnd: "07/31/2026",
        dueDate: "08/01/2026",
        status: "scheduled",
        createdBy: profileId,
      });
      const combinedPaymentId = await ctx.db.insert("loanPayments", {
        loanId,
        chargeId: monthlyChargeId,
        amount: 4_333.33,
        paymentDate: "08/01/2026",
        dueDate: "08/01/2026",
        method: "ach",
        status: "on_time",
        recordedBy: profileId,
      });

      const underfundedMonthlyId = await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId: profileId,
        type: "monthly_interest",
        amount: 100,
        principalBasis: 10_000,
        interestRate: 12,
        periodStart: "08/01/2026",
        periodEnd: "08/31/2026",
        dueDate: "09/01/2026",
        status: "scheduled",
        createdBy: profileId,
      });
      const underfundedDrawId = await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId: profileId,
        type: "draw_proration",
        amount: 25,
        principalBasis: 2_500,
        interestRate: 12,
        periodStart: "08/20/2026",
        periodEnd: "08/31/2026",
        dueDate: "09/01/2026",
        status: "scheduled",
        createdBy: profileId,
      });
      await ctx.db.insert("loanPayments", {
        loanId,
        chargeId: underfundedMonthlyId,
        amount: 100,
        paymentDate: "09/01/2026",
        dueDate: "09/01/2026",
        method: "ach",
        status: "partial",
        recordedBy: profileId,
      });

      return {
        loanId,
        monthlyChargeId,
        drawChargeId,
        combinedPaymentId,
        underfundedMonthlyId,
        underfundedDrawId,
      };
    });

    const auditBefore = await t.query(
      internal.migrations.auditCombinedInterestChargeStatuses,
      {}
    );
    expect(auditBefore.incompleteGroups).toMatchObject([
      {
        loanId: fixture.loanId,
        dueDate: "08/01/2026",
        scheduledChargeIds: [fixture.drawChargeId],
        totalAmount: 4_333.33,
        paidAmount: 4_333.33,
      },
    ]);

    const dryRun = await t.mutation(
      internal.migrations.reconcileCombinedInterestChargeStatuses,
      { dryRun: true }
    );
    expect(dryRun).toMatchObject({
      dryRun: true,
      eligibleGroups: 1,
      chargesUpdated: 0,
      chargesWouldUpdate: 1,
      isDone: true,
    });
    expect(await t.run(async (ctx) => await ctx.db.get(fixture.drawChargeId)))
      .toMatchObject({ status: "scheduled" });

    const applied = await t.mutation(
      internal.migrations.reconcileCombinedInterestChargeStatuses,
      {}
    );
    expect(applied).toMatchObject({
      eligibleGroups: 1,
      chargesUpdated: 1,
      chargesWouldUpdate: 1,
      isDone: true,
    });

    const state = await t.run(async (ctx) => ({
      monthlyCharge: await ctx.db.get(fixture.monthlyChargeId),
      drawCharge: await ctx.db.get(fixture.drawChargeId),
      combinedPayment: await ctx.db.get(fixture.combinedPaymentId),
      underfundedMonthly: await ctx.db.get(fixture.underfundedMonthlyId),
      underfundedDraw: await ctx.db.get(fixture.underfundedDrawId),
      paymentCount: (
        await ctx.db
          .query("loanPayments")
          .withIndex("by_loanId", (q) => q.eq("loanId", fixture.loanId))
          .collect()
      ).length,
    }));
    expect(state.monthlyCharge).toMatchObject({ status: "paid" });
    expect(state.drawCharge).toMatchObject({ status: "paid" });
    expect(state.combinedPayment).toMatchObject({
      chargeId: fixture.monthlyChargeId,
      amount: 4_333.33,
    });
    expect(state.underfundedMonthly).toMatchObject({ status: "scheduled" });
    expect(state.underfundedDraw).toMatchObject({ status: "scheduled" });
    expect(state.paymentCount).toBe(2);

    const rerun = await t.mutation(
      internal.migrations.reconcileCombinedInterestChargeStatuses,
      {}
    );
    expect(rerun).toMatchObject({
      eligibleGroups: 0,
      chargesUpdated: 0,
      chargesWouldUpdate: 0,
    });
    expect(
      await t.query(internal.migrations.auditCombinedInterestChargeStatuses, {})
    ).toMatchObject({ incompleteGroups: [], isDone: true });
  });
});
