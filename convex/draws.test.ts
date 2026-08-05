/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("draw approval", () => {
  test("rejects a pre-closing wire date without changing principal or charges", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId, drawId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "draw-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Draw Admin",
        email: "draw-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Draw Borrower",
        email: "draw-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Draw Borrower",
        entityName: "Draw LLC",
        propertyAddress: "10 Draw St, Austin, TX",
        purchasePrice: 200_000,
        loanAmount: 250_000,
        closeDate: "01/15/2026",
        maturityDate: "12/31/2026",
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 2_000,
        pointsEarned: 7_500,
        drawFundsTotal: 50_000,
        drawFundsUsed: 0,
        status: "funded",
        createdBy: adminId,
      });
      const drawId = await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 10_000,
        workDescription: "Foundation",
        status: "pending",
      });
      return { userId, loanId, drawId };
    });

    const admin = t.withIdentity({ subject: userId });
    await expect(
      admin.mutation(api.draws.reviewDrawRequest, {
        id: drawId,
        status: "approved",
        wireDate: "01/14/2026",
      })
    ).rejects.toThrow("Wire date cannot be before the loan closing date");

    const state = await t.run(async (ctx) => ({
      loan: await ctx.db.get(loanId),
      draw: await ctx.db.get(drawId),
      charges: await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect(),
    }));
    expect(state.loan?.drawFundsUsed).toBe(0);
    expect(state.draw?.status).toBe("pending");
    expect(state.charges).toHaveLength(0);
  });
});
