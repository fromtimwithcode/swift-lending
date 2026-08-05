/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("combined interest payments", () => {
  test("one payment reconciles monthly interest and draw proration for the same due date", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId, monthlyChargeId, drawChargeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "payment-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Payment Admin",
        email: "payment-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Payment Borrower",
        email: "payment-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Payment Borrower",
        entityName: "Payment LLC",
        propertyAddress: "10 Payment St, Austin, TX",
        purchasePrice: 200_000,
        loanAmount: 200_000,
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 2_000,
        pointsEarned: 6_000,
        status: "funded",
        createdBy: adminId,
      });
      const chargeBase = {
        loanId,
        borrowerId,
        interestRate: 12,
        periodStart: "07/01/2026",
        periodEnd: "07/31/2026",
        dueDate: "08/01/2026",
        status: "scheduled" as const,
        createdBy: adminId,
      };
      const monthlyChargeId = await ctx.db.insert("loanCharges", {
        ...chargeBase,
        type: "monthly_interest",
        amount: 2_000,
        principalBasis: 200_000,
      });
      const drawChargeId = await ctx.db.insert("loanCharges", {
        ...chargeBase,
        type: "draw_proration",
        amount: 50,
        principalBasis: 10_000,
      });
      return { userId, loanId, monthlyChargeId, drawChargeId };
    });

    const admin = t.withIdentity({ subject: userId });
    const result = await admin.mutation(api.loanPayments.recordPayment, {
      loanId,
      amount: 2_050,
      paymentDate: "08/01/2026",
      dueDate: "08/01/2026",
      method: "ach",
      status: "on_time",
    });

    expect(result).toMatchObject({ chargeId: null, chargeMarkedPaid: true });
    const state = await t.run(async (ctx) => ({
      monthly: await ctx.db.get(monthlyChargeId),
      draw: await ctx.db.get(drawChargeId),
      payments: await ctx.db
        .query("loanPayments")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect(),
    }));
    expect(state.monthly?.status).toBe("paid");
    expect(state.draw?.status).toBe("paid");
    expect(state.payments).toHaveLength(1);

    await t.run(async (ctx) => {
      await ctx.db.patch(state.payments[0]._id, {
        chargeId: monthlyChargeId,
      });
    });
    await expect(
      admin.mutation(api.loanCharges.removeCharge, { id: drawChargeId })
    ).rejects.toThrow("Remove related payment records");
  });
});
