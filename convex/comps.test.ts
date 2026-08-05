/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("comparable refresh", () => {
  test("considers candidates beyond the first 1,000 loans", async () => {
    const t = convexTest(schema, modules);
    const { userId, targetLoanId, bestCandidateId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "comps@example.com" });
      const profileId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Comps Admin",
        email: "comps@example.com",
        isActive: true,
      });
      const targetLoanId = await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Target Borrower",
        entityName: "Target LLC",
        propertyAddress: "100 Main St, Austin, TX",
        purchasePrice: 300_000,
        loanAmount: 300_000,
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 3_000,
        pointsEarned: 9_000,
        status: "funded",
        createdBy: profileId,
      });

      for (let index = 0; index < 1_001; index++) {
        await ctx.db.insert("loans", {
          borrowerId: profileId,
          borrowerName: `Candidate ${index}`,
          entityName: `Candidate ${index} LLC`,
          propertyAddress: `${index} Remote Rd, Miami, FL`,
          purchasePrice: 50_000,
          loanAmount: 50_000,
          terms: "Test",
          interestRate: 12,
          monthlyPayment: 500,
          pointsEarned: 1_500,
          status: "closed",
          createdBy: profileId,
        });
      }

      const bestCandidateId = await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Best Candidate",
        entityName: "Best Candidate LLC",
        propertyAddress: "200 Main St, Austin, TX",
        purchasePrice: 300_000,
        loanAmount: 300_000,
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 3_000,
        pointsEarned: 9_000,
        status: "closed",
        createdBy: profileId,
      });

      return { userId, targetLoanId, bestCandidateId };
    });

    const admin = t.withIdentity({ subject: userId });
    await admin.action(api.comps.fetchComps, { loanId: targetLoanId });

    const comps = await t.run(async (ctx) =>
      await ctx.db
        .query("propertyComps")
        .withIndex("by_loanId", (q) => q.eq("loanId", targetLoanId))
        .collect()
    );
    expect(comps.some((comp) => comp.sourceLoanId === bestCandidateId)).toBe(true);
  }, 20_000);

  test("does not persist rankings from a superseded configuration", async () => {
    const t = convexTest(schema, modules);
    const { profileId, loanId } = await t.run(async (ctx) => {
      const profileId = await ctx.db.insert("userProfiles", {
        role: "admin",
        displayName: "Comps Admin",
        email: "stale-comps@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId: profileId,
        borrowerName: "Target Borrower",
        entityName: "Target LLC",
        propertyAddress: "100 Main St, Austin, TX",
        purchasePrice: 300_000,
        loanAmount: 300_000,
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 3_000,
        pointsEarned: 9_000,
        status: "funded",
        createdBy: profileId,
      });
      return { profileId, loanId };
    });

    await expect(
      t.mutation(internal.comps.persistFetchedComps, {
        loanId,
        adminId: profileId,
        adminName: "Comps Admin",
        propertyAddress: "100 Main St, Austin, TX",
        configurationVersion: 1,
        internalComps: [],
      })
    ).rejects.toThrow("Comparable configuration changed during refresh");
  });
});
