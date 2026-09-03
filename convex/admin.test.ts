/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function createProfiles() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "loan-admin@example.com" });
    const adminId = await ctx.db.insert("userProfiles", {
      authUserId: userId,
      role: "admin",
      displayName: "Loan Admin",
      email: "loan-admin@example.com",
      isActive: true,
    });
    const borrowerId = await ctx.db.insert("userProfiles", {
      role: "borrower",
      displayName: "Loan Borrower",
      email: "loan-borrower@example.com",
      isActive: true,
    });
    return { userId, adminId, borrowerId };
  });
  return { t, admin: t.withIdentity({ subject: fixture.userId }), ...fixture };
}

describe("loan funding source of truth", () => {
  test("records funds advanced at closing in the approved-draw ledger", async () => {
    const { t, admin, borrowerId } = await createProfiles();
    const loanId = await admin.mutation(api.admin.createLoan, {
      borrowerId,
      borrowerName: "Loan Borrower",
      entityName: "Borrower LLC",
      propertyAddress: "10 Ledger St, Austin, TX",
      purchasePrice: 150_000,
      loanAmount: 200_000,
      rehabBudgetTotal: 50_000,
      closeDate: "01/15/2026",
      maturityDate: "12/31/2026",
      terms: "Test terms",
      interestRate: 12,
      pointsEarned: 0,
      status: "funded",
      titleCompany: "Test Title",
      titleCompanyContact: "Title Contact",
      titleCompanyContactEmail: "title@example.com",
      titleCompanyContactPhone: "555-555-1212",
      strategy: "flip_and_resell",
      propertyType: "single_family",
      bedrooms: 3,
      bathrooms: 2,
      squareFeetAboveGrade: 1_500,
      squareFeetBelowGrade: 0,
      unitDetails: [],
      paymentType: "monthly",
      drawFundsTotal: 50_000,
      drawFundsUsed: 20_000,
    });

    const state = await t.run(async (ctx) => ({
      loan: await ctx.db.get(loanId),
      draws: await ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect(),
      charges: await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect(),
    }));

    expect(state.loan).toMatchObject({ drawFundsUsed: 20_000, monthlyPayment: 1_700 });
    expect(state.draws).toMatchObject([
      {
        amountRequested: 20_000,
        status: "approved",
        wireDate: "01/15/2026",
        source: "opening_balance",
      },
    ]);
    expect(state.charges.find((charge) => charge.type === "prepaid_interest"))
      .toMatchObject({ principalBasis: 170_000 });
    expect(state.charges.some((charge) => charge.type === "draw_proration")).toBe(false);
  });

  test("rejects direct edits to the server-managed funded total", async () => {
    const { t, admin, adminId, borrowerId } = await createProfiles();
    const loanId = await t.run(async (ctx) =>
      await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Loan Borrower",
        entityName: "Borrower LLC",
        propertyAddress: "11 Ledger St, Austin, TX",
        purchasePrice: 100_000,
        loanAmount: 125_000,
        terms: "Test terms",
        interestRate: 12,
        monthlyPayment: 1_000,
        pointsEarned: 3_750,
        drawFundsTotal: 25_000,
        drawFundsUsed: 0,
        status: "funded",
        createdBy: adminId,
      })
    );

    await expect(
      admin.mutation(api.admin.updateLoan, { id: loanId, drawFundsUsed: 5_000 })
    ).rejects.toThrow("cannot be edited directly");
    expect((await t.run(async (ctx) => await ctx.db.get(loanId)))?.drawFundsUsed).toBe(0);
  });
});
