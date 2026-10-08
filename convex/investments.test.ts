/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { parseIsoCalendarDay } from "./lib/investmentSchedule";

const modules = import.meta.glob("./**/*.ts");

function day(iso: string) {
  const value = parseIsoCalendarDay(iso);
  if (value === null) throw new Error(`Invalid test date ${iso}`);
  return value;
}

const terms = {
  investmentAmount: 100_000,
  interestRate: 10,
  inceptionDate: day("2026-10-12"),
  firstPaymentDate: day("2026-11-12"),
  priorPaymentsReceived: 0,
};

const today = day("2027-01-05");

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2027-01-05T18:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const profile = async (role: "admin" | "investor" | "borrower", name: string) => {
      const authUserId = await ctx.db.insert("users", { email: `${name}@example.com` });
      const profileId = await ctx.db.insert("userProfiles", {
        authUserId,
        role,
        displayName: name,
        email: `${name}@example.com`,
        isActive: true,
      });
      return { authUserId, profileId };
    };
    return {
      admin: await profile("admin", "Admin"),
      investor: await profile("investor", "Michael Scaffidi"),
      otherInvestor: await profile("investor", "Other Investor"),
      borrower: await profile("borrower", "Borrower"),
    };
  });
  return {
    t,
    ids,
    admin: t.withIdentity({ subject: ids.admin.authUserId }),
    investor: t.withIdentity({ subject: ids.investor.authUserId }),
    otherInvestor: t.withIdentity({ subject: ids.otherInvestor.authUserId }),
    borrower: t.withIdentity({ subject: ids.borrower.authUserId }),
  };
}

async function activity(t: ReturnType<typeof convexTest>, action: string) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("activityLog").collect()).filter((entry) => entry.action === action)
  );
}

describe("investments", () => {
  test("calculates the next payment, interest earned, and past-due amounts from payouts", async () => {
    const { t, ids, admin, investor } = await fixture();
    const investmentId = await admin.mutation(api.investments.create, {
      investorId: ids.investor.profileId,
      ...terms,
      notes: "  Wire from First Bank  ",
    });

    await admin.mutation(api.investments.recordPayout, {
      investmentId,
      amount: 833.33,
      paidDate: day("2026-11-12"),
      method: "ach",
    });
    await admin.mutation(api.investments.recordPayout, {
      investmentId,
      amount: 500,
      paidDate: day("2026-12-12"),
      method: "check",
      notes: "Check 1042",
    });

    const detail = await admin.query(api.investments.getInvestorDetail, { id: ids.investor.profileId, today });
    expect(detail.today).toBe(day("2027-01-05"));
    expect(detail.investments).toHaveLength(1);
    expect(detail.investments[0]).toMatchObject({
      ...terms,
      notes: "Wire from First Bank",
      summary: {
        monthlyPayment: 833.33,
        interestEarned: 2311.82,
        paidToDate: 1333.33,
        unpaidInterest: 978.49,
        pastDue: { amount: 333.33, since: day("2026-12-12") },
        nextPayment: { amount: 833.33, dueDate: day("2027-01-12") },
      },
    });
    expect(detail.investments[0].payouts.map((payout) => payout.paidDate)).toEqual([
      day("2026-12-12"),
      day("2026-11-12"),
    ]);
    expect(detail.totals).toMatchObject({
      totalInvested: 100_000,
      avgInterestRate: 10,
      monthlyPayments: 833.33,
      pastDueAmount: 333.33,
      nextPayment: { amount: 833.33, dueDate: day("2027-01-12") },
    });

    const portfolio = await investor.query(api.investments.getMyPortfolio, { today });
    expect(portfolio.investments[0].summary).toEqual(detail.investments[0].summary);

    expect((await activity(t, "investment.payout")).map((entry) => entry.details)).toEqual([
      "Recorded $833.33 ACH payment on 11/12/2026 for Michael Scaffidi's $100,000.00 investment",
      "Recorded $500.00 Check payment on 12/12/2026 for Michael Scaffidi's $100,000.00 investment",
    ]);
  });

  test("rejects invalid terms and payouts with readable messages", async () => {
    const { ids, admin } = await fixture();
    await expect(
      admin.mutation(api.investments.create, {
        investorId: ids.investor.profileId,
        ...terms,
        firstPaymentDate: terms.inceptionDate,
      })
    ).rejects.toMatchObject({
      data: { publicMessage: "The first payment date must be after the inception date." },
    });

    const investmentId = await admin.mutation(api.investments.create, {
      investorId: ids.investor.profileId,
      ...terms,
    });
    await expect(
      admin.mutation(api.investments.recordPayout, {
        investmentId,
        amount: 833.33,
        paidDate: day("2027-01-06"),
        method: "ach",
      })
    ).rejects.toMatchObject({ data: { publicMessage: "The payment date can't be in the future." } });
  });

  test("updates terms with a change log and blocks deleting an investment that has payments", async () => {
    const { t, ids, admin } = await fixture();
    const investmentId = await admin.mutation(api.investments.create, {
      investorId: ids.investor.profileId,
      ...terms,
    });
    await admin.mutation(api.investments.update, {
      id: investmentId,
      ...terms,
      interestRate: 12,
      firstPaymentDate: day("2026-12-01"),
    });
    await admin.mutation(api.investments.update, {
      id: investmentId,
      ...terms,
      interestRate: 12,
      firstPaymentDate: day("2026-12-01"),
    });
    expect((await activity(t, "investment.update")).map((entry) => entry.details)).toEqual([
      "Updated Michael Scaffidi's $100,000.00 investment\nRate: 10% → 12%\nFirst payment: 11/12/2026 → 12/01/2026",
    ]);

    const payoutId = await admin.mutation(api.investments.recordPayout, {
      investmentId,
      amount: 1000,
      paidDate: day("2026-12-01"),
      method: "wire",
    });
    await expect(admin.mutation(api.investments.remove, { id: investmentId })).rejects.toMatchObject({
      data: { publicMessage: "Delete this investment's recorded payments before deleting the investment." },
    });

    expect(await admin.mutation(api.investments.removePayout, { id: payoutId })).toEqual({ deleted: true });
    expect(await admin.mutation(api.investments.removePayout, { id: payoutId })).toEqual({ deleted: false });
    await admin.mutation(api.investments.remove, { id: investmentId });
    expect(await t.run((ctx) => ctx.db.get(investmentId))).toBeNull();
  });

  test("investors see only their own portfolio and cannot change it", async () => {
    const { ids, admin, investor, otherInvestor, borrower } = await fixture();
    await admin.mutation(api.investments.create, { investorId: ids.investor.profileId, ...terms });

    expect((await otherInvestor.query(api.investments.getMyPortfolio, { today })).investments).toEqual([]);
    await expect(investor.query(api.investments.getMyPortfolio, { today: today + 1 })).rejects.toThrow(
      "Invalid date"
    );
    await expect(borrower.query(api.investments.getMyPortfolio, { today })).rejects.toThrow();
    await expect(
      investor.query(api.investments.getInvestorDetail, { id: ids.investor.profileId, today })
    ).rejects.toThrow();
    await expect(
      investor.mutation(api.investments.create, { investorId: ids.investor.profileId, ...terms })
    ).rejects.toThrow();
  });

  test("reads and migrates investments saved before the payment schedule", async () => {
    const { t, ids, admin } = await fixture();
    const investmentId = await t.run((ctx) =>
      ctx.db.insert("investments", {
        investorId: ids.investor.profileId,
        investmentAmount: 100_000,
        inceptionDate: day("2026-10-12"),
        interestRate: 10,
        totalPaymentsReceived: 833.33,
        nextPaymentDate: day("2026-11-13"),
      })
    );

    const before = await admin.query(api.investments.getInvestorDetail, { id: ids.investor.profileId, today });
    expect(before.investments[0]).toMatchObject({
      firstPaymentDate: day("2026-11-13"),
      priorPaymentsReceived: 833.33,
    });

    expect(await t.mutation(internal.migrations.backfillInvestmentPaymentSchedules, {})).toEqual({
      updated: 1,
      isDone: true,
    });
    expect(await t.mutation(internal.migrations.backfillInvestmentPaymentSchedules, {})).toEqual({
      updated: 0,
      isDone: true,
    });
    const migrated = await t.run((ctx) => ctx.db.get(investmentId));
    expect(migrated).toMatchObject({ firstPaymentDate: day("2026-11-13"), priorPaymentsReceived: 833.33 });
    expect(migrated).not.toHaveProperty("nextPaymentDate");
    expect(migrated).not.toHaveProperty("totalPaymentsReceived");

    const after = await admin.query(api.investments.getInvestorDetail, { id: ids.investor.profileId, today });
    expect(after.investments[0].summary).toEqual(before.investments[0].summary);
  });
});
