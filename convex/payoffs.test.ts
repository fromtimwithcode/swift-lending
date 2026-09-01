/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { calculateDatedPayoff } from "./lib/payoffCalculations";

const modules = import.meta.glob("./**/*.ts");

const baseLoan = {
  loanAmount: 100_000,
  drawFundsTotal: undefined,
  drawFundsUsed: undefined,
  interestRate: 12,
  closeDate: "01/01/2026",
};

describe("dated payoff calculation", () => {
  test("credits paid closing interest and monthly payments without double-counting paid charges", () => {
    const payoff = calculateDatedPayoff({
      loan: baseLoan,
      draws: [],
      payments: [
        {
          amount: 1_000,
          paymentDate: "02/01/2026",
          dueDate: "02/01/2026",
          status: "on_time",
        },
        {
          amount: 1_000,
          paymentDate: "03/01/2026",
          dueDate: "03/01/2026",
          status: "late",
        },
      ],
      charges: [
        {
          amount: 1_000,
          type: "prepaid_interest",
          dueDate: "01/01/2026",
          periodEnd: "01/31/2026",
          status: "paid",
        },
        {
          amount: 1_000,
          type: "monthly_interest",
          dueDate: "02/01/2026",
          periodEnd: "01/31/2026",
          status: "paid",
        },
        {
          amount: 1_000,
          type: "monthly_interest",
          dueDate: "03/01/2026",
          periodEnd: "02/28/2026",
          status: "paid",
        },
      ],
      goodThroughDate: "04/01/2026",
    });

    expect(payoff).toEqual({
      principal: 100_000,
      grossAccruedInterest: 3_000,
      interestCredits: 3_000,
      unpaidInterest: 0,
      totalPayoff: 100_000,
      perDiemInterest: 33.33,
    });
  });

  test("segments interest when a draw is funded", () => {
    const payoff = calculateDatedPayoff({
      loan: {
        ...baseLoan,
        loanAmount: 150_000,
        drawFundsTotal: 50_000,
        drawFundsUsed: 50_000,
      },
      draws: [
        {
          amountRequested: 50_000,
          status: "approved",
          wireDate: "02/01/2026",
        },
      ],
      payments: [],
      charges: [],
      goodThroughDate: "03/01/2026",
    });

    expect(payoff).toMatchObject({
      principal: 150_000,
      grossAccruedInterest: 2_500,
      unpaidInterest: 2_500,
      totalPayoff: 152_500,
      perDiemInterest: 50,
    });
  });

  test("credits prepaid closing interest even when payoff is before month end", () => {
    const payoff = calculateDatedPayoff({
      loan: baseLoan,
      draws: [],
      payments: [],
      charges: [
        {
          amount: 1_000,
          type: "prepaid_interest",
          dueDate: "01/01/2026",
          periodEnd: "01/31/2026",
          status: "paid",
        },
      ],
      goodThroughDate: "01/15/2026",
    });

    expect(payoff.grossAccruedInterest).toBe(466.67);
    expect(payoff.interestCredits).toBe(1_000);
    expect(payoff.unpaidInterest).toBe(0);
  });

  test("excludes missed payments and applies waivers through the payoff date", () => {
    const payoff = calculateDatedPayoff({
      loan: baseLoan,
      draws: [],
      payments: [
        {
          amount: 1_000,
          paymentDate: "02/01/2026",
          dueDate: "02/01/2026",
          status: "partial",
        },
        {
          amount: 1_000,
          paymentDate: "03/01/2026",
          dueDate: "03/01/2026",
          status: "missed",
        },
      ],
      charges: [
        {
          amount: 1_000,
          type: "prepaid_interest",
          dueDate: "01/01/2026",
          periodEnd: "01/31/2026",
          status: "paid",
        },
        {
          amount: 1_000,
          type: "monthly_interest",
          dueDate: "03/01/2026",
          periodEnd: "02/28/2026",
          status: "waived",
        },
      ],
      goodThroughDate: "04/01/2026",
    });

    expect(payoff.interestCredits).toBe(3_000);
    expect(payoff.unpaidInterest).toBe(0);
  });

  test("refuses a payoff when funded draw records disagree with the saved balance", () => {
    expect(() =>
      calculateDatedPayoff({
        loan: { ...baseLoan, drawFundsTotal: 25_000, drawFundsUsed: 10_000 },
        draws: [],
        payments: [],
        charges: [],
        goodThroughDate: "02/01/2026",
      })
    ).toThrow("Funding history needs reconciliation");
  });
});

describe("payoff statement access", () => {
  test("returns the same statement to an admin and the owning borrower", async () => {
    const t = convexTest(schema, modules);
    const fixture = await t.run(async (ctx) => {
      const adminUserId = await ctx.db.insert("users", {
        email: "payoff-admin@example.com",
      });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: adminUserId,
        role: "admin",
        displayName: "Payoff Admin",
        email: "payoff-admin@example.com",
        isActive: true,
      });
      const borrowerUserId = await ctx.db.insert("users", {
        email: "payoff-borrower@example.com",
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        authUserId: borrowerUserId,
        role: "borrower",
        displayName: "Payoff Borrower",
        email: "payoff-borrower@example.com",
        isActive: true,
      });
      const otherUserId = await ctx.db.insert("users", {
        email: "other-borrower@example.com",
      });
      await ctx.db.insert("userProfiles", {
        authUserId: otherUserId,
        role: "borrower",
        displayName: "Other Borrower",
        email: "other-borrower@example.com",
        isActive: true,
      });
      const investorUserId = await ctx.db.insert("users", {
        email: "payoff-investor@example.com",
      });
      await ctx.db.insert("userProfiles", {
        authUserId: investorUserId,
        role: "investor",
        displayName: "Payoff Investor",
        email: "payoff-investor@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Payoff Borrower",
        entityName: "Payoff Holdings LLC",
        propertyAddress: "524 E. Oak St., Juneau, WI 53039",
        purchasePrice: 100_000,
        loanAmount: 100_000,
        closeDate: "01/01/2020",
        maturityDate: "12/31/2099",
        terms: "Test terms",
        interestRate: 12,
        monthlyPayment: 1_000,
        pointsEarned: 3_000,
        status: "funded",
        createdBy: adminId,
      });
      return {
        adminUserId,
        borrowerUserId,
        otherUserId,
        investorUserId,
        loanId,
      };
    });

    const args = {
      loanId: fixture.loanId,
      goodThroughDate: "12/31/2099",
    };
    const adminStatement = await t
      .withIdentity({ subject: fixture.adminUserId })
      .query(api.payoffs.getPayoffStatement, args);
    const borrowerStatement = await t
      .withIdentity({ subject: fixture.borrowerUserId })
      .query(api.payoffs.getPayoffStatement, args);

    expect(borrowerStatement).toEqual(adminStatement);
    expect(adminStatement).toMatchObject({
      borrowerName: "Payoff Holdings LLC",
      propertyAddress: "524 E. Oak St., Juneau, WI 53039",
      principal: 100_000,
      perDiemInterest: 33.33,
      goodThroughDate: "12/31/2099",
    });

    await expect(
      t
        .withIdentity({ subject: fixture.otherUserId })
        .query(api.payoffs.getPayoffStatement, args)
    ).rejects.toThrow("Not your loan");
    await expect(
      t
        .withIdentity({ subject: fixture.investorUserId })
        .query(api.payoffs.getPayoffStatement, args)
    ).rejects.toThrow("Requires one of: admin, borrower");
  });
});
