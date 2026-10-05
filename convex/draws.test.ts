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

  test("refuses approval when the cached funded total and ledger disagree", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId, drawId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "mismatch-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Mismatch Admin",
        email: "mismatch-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Mismatch Borrower",
        email: "mismatch-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Mismatch Borrower",
        entityName: "Mismatch LLC",
        propertyAddress: "20 Draw St, Austin, TX",
        purchasePrice: 200_000,
        loanAmount: 250_000,
        closeDate: "01/15/2026",
        maturityDate: "12/31/2026",
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 2_100,
        pointsEarned: 7_500,
        drawFundsUsed: 10_000,
        status: "funded",
        createdBy: adminId,
      });
      const drawId = await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 5_000,
        workDescription: "Framing",
        status: "pending",
        source: "request",
      });
      return { userId, loanId, drawId };
    });

    const admin = t.withIdentity({ subject: userId });
    await expect(
      admin.mutation(api.draws.createManualDrawRequest, {
        loanId,
        amountRequested: 1_000,
        workDescription: "Additional work",
      })
    ).rejects.toThrow("Funding history needs reconciliation");
    await expect(
      admin.mutation(api.draws.reviewDrawRequest, {
        id: drawId,
        status: "approved",
        wireDate: "02/01/2026",
      })
    ).rejects.toThrow("Funding history needs reconciliation");

    const state = await t.run(async (ctx) => ({
      loan: await ctx.db.get(loanId),
      draw: await ctx.db.get(drawId),
    }));
    expect(state.loan?.drawFundsUsed).toBe(10_000);
    expect(state.draw?.status).toBe("pending");
  });

  test("derives the cache and period charge from approved dated records", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId, drawId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "ledger-draw-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Ledger Draw Admin",
        email: "ledger-draw-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Ledger Draw Borrower",
        email: "ledger-draw-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Ledger Draw Borrower",
        entityName: "Ledger Draw LLC",
        propertyAddress: "21 Draw St, Austin, TX",
        purchasePrice: 200_000,
        loanAmount: 250_000,
        closeDate: "01/15/2026",
        maturityDate: "12/31/2026",
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 2_100,
        pointsEarned: 7_500,
        drawFundsTotal: 50_000,
        drawFundsUsed: 10_000,
        status: "funded",
        createdBy: adminId,
      });
      await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 10_000,
        workDescription: "Foundation",
        status: "approved",
        wireDate: "02/01/2026",
        source: "request",
      });
      const drawId = await ctx.db.insert("drawRequests", {
        loanId,
        borrowerId,
        amountRequested: 5_000,
        workDescription: "Framing",
        status: "pending",
        source: "request",
      });
      return { userId, loanId, drawId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.draws.reviewDrawRequest, {
      id: drawId,
      status: "approved",
      wireDate: "03/15/2026",
    });

    const state = await t.run(async (ctx) => ({
      loan: await ctx.db.get(loanId),
      draw: await ctx.db.get(drawId),
      aprilCharges: (await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect()).filter((charge) => charge.dueDate === "04/01/2026"),
    }));
    expect(state.loan).toMatchObject({ drawFundsUsed: 15_000, monthlyPayment: 2_150 });
    expect(state.draw).toMatchObject({
      status: "approved",
      wireDate: "03/15/2026",
      source: "request",
    });
    expect(state.aprilCharges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "monthly_interest", amount: 2_100 }),
        expect.objectContaining({ type: "draw_proration", amount: 27.37 }),
      ])
    );
  });

  test("includes closing-day funding in prepaid interest without a second proration", async () => {
    const t = convexTest(schema, modules);
    const { userId, loanId, drawId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "closing-draw-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "admin",
        displayName: "Closing Draw Admin",
        email: "closing-draw-admin@example.com",
        isActive: true,
      });
      const borrowerId = await ctx.db.insert("userProfiles", {
        role: "borrower",
        displayName: "Closing Draw Borrower",
        email: "closing-draw-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Closing Draw Borrower",
        entityName: "Closing Draw LLC",
        propertyAddress: "22 Draw St, Austin, TX",
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
        workDescription: "Closing-day advance",
        status: "pending",
        source: "request",
      });
      return { userId, loanId, drawId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.draws.reviewDrawRequest, {
      id: drawId,
      status: "approved",
      wireDate: "01/15/2026",
    });

    const state = await t.run(async (ctx) => ({
      loan: await ctx.db.get(loanId),
      charges: await ctx.db
        .query("loanCharges")
        .withIndex("by_loanId", (q) => q.eq("loanId", loanId))
        .collect(),
    }));
    expect(state.loan).toMatchObject({ drawFundsUsed: 10_000, monthlyPayment: 2_100 });
    expect(state.charges.find((charge) => charge.type === "prepaid_interest"))
      .toMatchObject({ principalBasis: 210_000 });
    expect(state.charges.some((charge) => charge.type === "draw_proration")).toBe(false);
  });
});

describe("draw availability", () => {
  const approvedDraws = [
    { amountRequested: 4_806.29, wireDate: "06/30/2026" },
    { amountRequested: 8_730.71, wireDate: "07/30/2026" },
    { amountRequested: 4_892.65, wireDate: "08/17/2026" },
    { amountRequested: 6_509.79, wireDate: "08/31/2026" },
    { amountRequested: 33_138.35, wireDate: "09/03/2026" },
  ];

  async function seedLoanWithFinalDrawRemaining(pendingAmount?: number) {
    const t = convexTest(schema, modules);
    const ids = await t.run(async (ctx) => {
      const adminUserId = await ctx.db.insert("users", { email: "final-draw-admin@example.com" });
      const adminId = await ctx.db.insert("userProfiles", {
        authUserId: adminUserId,
        role: "admin",
        displayName: "Final Draw Admin",
        email: "final-draw-admin@example.com",
        isActive: true,
      });
      const borrowerUserId = await ctx.db.insert("users", { email: "final-draw-borrower@example.com" });
      const borrowerId = await ctx.db.insert("userProfiles", {
        authUserId: borrowerUserId,
        role: "borrower",
        displayName: "Final Draw Borrower",
        email: "final-draw-borrower@example.com",
        isActive: true,
      });
      const loanId = await ctx.db.insert("loans", {
        borrowerId,
        borrowerName: "Final Draw Borrower",
        entityName: "Final Draw LLC",
        propertyAddress: "20 Draw St, Austin, TX",
        purchasePrice: 400_000,
        loanAmount: 448_000,
        closeDate: "06/01/2026",
        maturityDate: "06/01/2027",
        terms: "Test",
        interestRate: 12,
        monthlyPayment: 4_480,
        pointsEarned: 13_440,
        drawFundsTotal: 62_400,
        drawFundsUsed: 58_077.79,
        status: "funded",
        createdBy: adminId,
      });
      for (const [index, draw] of approvedDraws.entries()) {
        await ctx.db.insert("drawRequests", {
          loanId,
          borrowerId,
          ...draw,
          workDescription: `Phase ${index + 1}`,
          status: "approved",
        });
      }
      const pendingDrawId = pendingAmount === undefined
        ? undefined
        : await ctx.db.insert("drawRequests", {
            loanId,
            borrowerId,
            amountRequested: pendingAmount,
            workDescription: "Final phase",
            status: "pending",
          });
      return { adminUserId, borrowerUserId, loanId, pendingDrawId };
    });
    return {
      ...ids,
      t,
      admin: t.withIdentity({ subject: ids.adminUserId }),
      borrower: t.withIdentity({ subject: ids.borrowerUserId }),
    };
  }

  test("admin can create a draw for the exact remaining balance", async () => {
    const { admin, loanId } = await seedLoanWithFinalDrawRemaining();
    await expect(
      admin.mutation(api.draws.createManualDrawRequest, {
        loanId,
        amountRequested: 4_322.21,
        workDescription: "Final phase",
      })
    ).resolves.toBeDefined();
  });

  test("borrower can request the exact remaining balance", async () => {
    const { borrower, loanId } = await seedLoanWithFinalDrawRemaining();
    await expect(
      borrower.mutation(api.borrower.submitDrawRequest, {
        loanId,
        amountRequested: 4_322.21,
        workDescription: "Final phase",
      })
    ).resolves.toBeDefined();
  });

  test("admin can edit a pending draw up to the exact remaining balance", async () => {
    const { t, admin, pendingDrawId } = await seedLoanWithFinalDrawRemaining(4_000);
    await admin.mutation(api.draws.updateDrawRequest, {
      id: pendingDrawId!,
      amountRequested: 4_322.21,
      workDescription: "Final phase",
    });
    const draw = await t.run((ctx) => ctx.db.get(pendingDrawId!));
    expect(draw?.amountRequested).toBe(4_322.21);
  });

  test("still rejects one cent over the remaining balance", async () => {
    const { admin, borrower, loanId } = await seedLoanWithFinalDrawRemaining();
    const args = { loanId, amountRequested: 4_322.22, workDescription: "Final phase" };
    await expect(admin.mutation(api.draws.createManualDrawRequest, args))
      .rejects.toThrow("Available: $4,322.21");
    await expect(borrower.mutation(api.borrower.submitDrawRequest, args))
      .rejects.toThrow("Available: $4,322.21");
  });
});
