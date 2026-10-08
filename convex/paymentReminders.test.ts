/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { formatUsDate } from "./lib/dates";

const modules = import.meta.glob("./**/*.ts");

function firstOfMonth(offset: number) {
  const now = new Date();
  return formatUsDate(new Date(now.getFullYear(), now.getMonth() + offset, 1));
}

const olderDueDate = firstOfMonth(-2);
const latestDueDate = firstOfMonth(-1);

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const now = new Date();
    const userId = await ctx.db.insert("users", { email: "reminder-admin@example.com" });
    const adminId = await ctx.db.insert("userProfiles", {
      authUserId: userId,
      role: "admin",
      displayName: "Reminder Admin",
      email: "reminder-admin@example.com",
      isActive: true,
    });
    const borrowerUserId = await ctx.db.insert("users", { email: "reminder-borrower@example.com" });
    const borrowerId = await ctx.db.insert("userProfiles", {
      authUserId: borrowerUserId,
      role: "borrower",
      displayName: "Reminder Borrower",
      email: "reminder-borrower@example.com",
      isActive: true,
    });
    const loanId = await ctx.db.insert("loans", {
      borrowerId,
      borrowerName: "Reminder Borrower",
      entityName: "Reminder LLC",
      propertyAddress: "1412 N 3rd Street, Wausau, WI",
      purchasePrice: 100_000,
      loanAmount: 100_000,
      terms: "Test",
      interestRate: 12,
      monthlyPayment: 1_000,
      pointsEarned: 3_000,
      status: "funded",
      closeDate: formatUsDate(new Date(now.getFullYear(), now.getMonth() - 4, 15)),
      maturityDate: formatUsDate(new Date(now.getFullYear() + 1, now.getMonth(), 15)),
      paymentDueDay: 1,
      createdBy: adminId,
    });
    const chargeIds: Record<string, Id<"loanCharges">> = {};
    for (const offset of [-2, -1, 0]) {
      const dueDate = firstOfMonth(offset);
      chargeIds[dueDate] = await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId,
        type: "monthly_interest",
        amount: 1_000,
        principalBasis: 100_000,
        interestRate: 12,
        periodStart: firstOfMonth(offset - 1),
        periodEnd: firstOfMonth(offset - 1),
        dueDate,
        status: "scheduled",
        createdBy: adminId,
      });
    }
    return { userId, borrowerUserId, adminId, borrowerId, loanId, chargeIds };
  });
  return {
    t,
    admin: t.withIdentity({ subject: ids.userId }),
    borrower: t.withIdentity({ subject: ids.borrowerUserId }),
    ...ids,
  };
}

async function remindersDueOn(
  admin: Awaited<ReturnType<typeof fixture>>["admin"],
  dueDate: string,
) {
  const data = await admin.query(api.loanPayments.getAdminPaymentReminders, {});
  return data.reminders.filter((reminder) => reminder.dueDate === dueDate);
}

describe("payment reminder deletion", () => {
  test("a removed monthly interest charge is not replaced by a monthly payment reminder", async () => {
    const { admin, chargeIds } = await fixture();
    expect(await remindersDueOn(admin, latestDueDate)).toHaveLength(1);

    await admin.mutation(api.loanCharges.removeCharge, { id: chargeIds[latestDueDate], reason: "Charged twice" });

    expect(await remindersDueOn(admin, latestDueDate)).toEqual([]);
  });

  test("waives the charge behind a reminder and audits the trimmed reason", async () => {
    const { t, admin, loanId, adminId, chargeIds } = await fixture();
    const [reminder] = await remindersDueOn(admin, latestDueDate);
    expect(reminder).toMatchObject({ source: "scheduled_charge", chargeId: chargeIds[latestDueDate] });

    const result = await admin.mutation(api.loanCharges.deletePaymentReminder, {
      loanId,
      dueDate: latestDueDate,
      source: "scheduled_charge",
      chargeId: reminder.chargeId,
      reason: "  Borrower paid by check outside the portal.\nConfirmed with title.  ",
    });

    expect(result).toEqual({ deleted: true });
    expect(await remindersDueOn(admin, latestDueDate)).toEqual([]);
    expect(await remindersDueOn(admin, olderDueDate)).toHaveLength(1);
    const state = await t.run(async (ctx) => ({
      charge: await ctx.db.get(chargeIds[latestDueDate]),
      log: await ctx.db.query("activityLog").collect(),
    }));
    expect(state.charge).toMatchObject({
      status: "waived",
      waiver: {
        reason: "Borrower paid by check outside the portal.\nConfirmed with title.",
        waivedBy: adminId,
        previousStatus: "scheduled",
      },
    });
    expect(state.log).toHaveLength(1);
    expect(state.log[0]).toMatchObject({
      action: "payment_reminder.delete",
      entityType: "loan",
      entityId: loanId,
      userName: "Reminder Admin",
    });
    const [summary, ...reason] = state.log[0].details!.split("\n");
    expect(summary).toContain("$1,000.00");
    expect(summary).toContain(latestDueDate);
    expect(summary).toContain("1412 N 3rd Street, Wausau, WI");
    expect(reason.join("\n")).toBe("Reason: Borrower paid by check outside the portal.\nConfirmed with title.");
  });

  test("waives every interest charge grouped into a combined reminder", async () => {
    const { t, admin, loanId, adminId, borrowerId, chargeIds } = await fixture();
    const drawChargeId = await t.run(async (ctx) =>
      await ctx.db.insert("loanCharges", {
        loanId,
        borrowerId,
        type: "draw_proration",
        amount: 50,
        principalBasis: 10_000,
        interestRate: 12,
        periodStart: olderDueDate,
        periodEnd: olderDueDate,
        dueDate: olderDueDate,
        status: "scheduled",
        createdBy: adminId,
      }),
    );
    const [reminder] = await remindersDueOn(admin, olderDueDate);
    expect(reminder.amount).toBe(1_050);
    expect(reminder.chargeId).toBeUndefined();

    await admin.mutation(api.loanCharges.deletePaymentReminder, {
      loanId,
      dueDate: olderDueDate,
      source: "scheduled_charge",
      reason: "Interest was rolled into the payoff.",
    });

    const charges = await t.run(async (ctx) => [
      await ctx.db.get(chargeIds[olderDueDate]),
      await ctx.db.get(drawChargeId),
    ]);
    expect(charges.map((charge) => charge?.status)).toEqual(["waived", "waived"]);
    expect(await remindersDueOn(admin, olderDueDate)).toEqual([]);
    const log = await t.run(async (ctx) => await ctx.db.query("activityLog").collect());
    expect(log).toHaveLength(1);
    expect(log[0].details).toContain("$1,050.00");
  });

  test("requires a nonblank reason of at most 2,000 characters without side effects", async () => {
    const { t, admin, loanId, chargeIds } = await fixture();
    for (const reason of ["", " \n ", "x".repeat(2_001)]) {
      await expect(
        admin.mutation(api.loanCharges.deletePaymentReminder, {
          loanId,
          dueDate: latestDueDate,
          source: "scheduled_charge",
          chargeId: chargeIds[latestDueDate],
          reason,
        }),
      ).rejects.toThrow();
      await expect(
        admin.mutation(api.loanCharges.removeCharge, { id: chargeIds[latestDueDate], reason }),
      ).rejects.toThrow();
    }
    const state = await t.run(async (ctx) => ({
      charge: await ctx.db.get(chargeIds[latestDueDate]),
      log: await ctx.db.query("activityLog").collect(),
    }));
    expect(state.charge?.status).toBe("scheduled");
    expect(state.log).toHaveLength(0);
  });

  test("waives only the unpaid balance of a short-paid reminder", async () => {
    const { t, admin, loanId, adminId, chargeIds } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert("loanPayments", {
        loanId,
        amount: 957.17,
        paymentDate: latestDueDate,
        dueDate: latestDueDate,
        method: "ach",
        status: "partial",
        chargeId: chargeIds[latestDueDate],
        recordedBy: adminId,
      });
    });
    const [reminder] = await remindersDueOn(admin, latestDueDate);
    expect(reminder.amount).toBe(42.83);

    await admin.mutation(api.loanCharges.deletePaymentReminder, {
      loanId,
      dueDate: latestDueDate,
      source: "scheduled_charge",
      chargeId: reminder.chargeId,
      reason: "Rounding difference written off",
    });

    expect(await remindersDueOn(admin, latestDueDate)).toEqual([]);
    const state = await t.run(async (ctx) => ({
      charge: await ctx.db.get(chargeIds[latestDueDate]),
      payments: await ctx.db.query("loanPayments").collect(),
      log: await ctx.db.query("activityLog").collect(),
    }));
    expect(state.charge?.status).toBe("waived");
    expect(state.payments).toHaveLength(1);
    expect(state.log[0].details).toContain("Monthly interest of $42.83");

    await admin.mutation(api.loanCharges.restoreCharge, { id: chargeIds[latestDueDate] });
    expect((await remindersDueOn(admin, latestDueDate))[0].amount).toBe(42.83);
  });

  test("a repeated delete changes nothing and is audited once", async () => {
    const { t, admin, loanId, chargeIds } = await fixture();
    const args = {
      loanId,
      dueDate: latestDueDate,
      source: "scheduled_charge" as const,
      chargeId: chargeIds[latestDueDate],
      reason: "Entered in error",
    };

    expect(await admin.mutation(api.loanCharges.deletePaymentReminder, args)).toEqual({ deleted: true });
    expect(await admin.mutation(api.loanCharges.deletePaymentReminder, args)).toEqual({ deleted: false });

    const log = await t.run(async (ctx) => await ctx.db.query("activityLog").collect());
    expect(log).toHaveLength(1);
  });

  test("rejects borrowers", async () => {
    const { admin, borrower, loanId, chargeIds } = await fixture();
    await expect(
      borrower.mutation(api.loanCharges.deletePaymentReminder, {
        loanId,
        dueDate: latestDueDate,
        source: "scheduled_charge",
        chargeId: chargeIds[latestDueDate],
        reason: "Not mine to delete",
      }),
    ).rejects.toThrow();
    await admin.mutation(api.loanCharges.removeCharge, { id: chargeIds[latestDueDate], reason: "Duplicate" });
    await expect(
      borrower.query(api.loanCharges.getDeletedPaymentItemsForLoan, { loanId }),
    ).rejects.toThrow();
    await expect(
      borrower.mutation(api.loanCharges.restoreCharge, { id: chargeIds[latestDueDate] }),
    ).rejects.toThrow();
  });

  test("lists a deleted charge with its reason and restores it", async () => {
    const { t, admin, loanId, chargeIds } = await fixture();
    await admin.mutation(api.loanCharges.deletePaymentReminder, {
      loanId,
      dueDate: latestDueDate,
      source: "scheduled_charge",
      chargeId: chargeIds[latestDueDate],
      reason: "Entered in error",
    });

    expect(await admin.query(api.loanCharges.getDeletedPaymentItemsForLoan, { loanId })).toMatchObject([
      {
        kind: "charge",
        id: chargeIds[latestDueDate],
        type: "monthly_interest",
        amount: 1_000,
        dueDate: latestDueDate,
        reason: "Entered in error",
        deletedByName: "Reminder Admin",
      },
    ]);

    expect(await admin.mutation(api.loanCharges.restoreCharge, { id: chargeIds[latestDueDate] })).toEqual({ restored: true });
    expect(await admin.mutation(api.loanCharges.restoreCharge, { id: chargeIds[latestDueDate] })).toEqual({ restored: false });

    const charge = await t.run(async (ctx) => await ctx.db.get(chargeIds[latestDueDate]));
    expect(charge?.status).toBe("scheduled");
    expect(charge?.waiver).toBeUndefined();
    expect(await remindersDueOn(admin, latestDueDate)).toHaveLength(1);
    expect(await admin.query(api.loanCharges.getDeletedPaymentItemsForLoan, { loanId })).toEqual([]);
    const log = await t.run(async (ctx) => await ctx.db.query("activityLog").collect());
    expect(log.map((entry) => entry.action)).toEqual(["payment_reminder.delete", "charge.restore"]);
  });

  test("an estimated monthly payment reminder can be dismissed and restored", async () => {
    const { t, admin, loanId, chargeIds } = await fixture();
    await t.run(async (ctx) => await ctx.db.delete(chargeIds[latestDueDate]));
    const [reminder] = await remindersDueOn(admin, latestDueDate);
    expect(reminder).toMatchObject({ source: "monthly_payment", amount: 1_000 });

    const args = {
      loanId,
      dueDate: latestDueDate,
      source: "monthly_payment" as const,
      reason: "Borrower is on a forbearance plan",
    };
    expect(await admin.mutation(api.loanCharges.deletePaymentReminder, args)).toEqual({ deleted: true });
    expect(await admin.mutation(api.loanCharges.deletePaymentReminder, args)).toEqual({ deleted: false });
    expect(await remindersDueOn(admin, latestDueDate)).toEqual([]);

    const [item] = await admin.query(api.loanCharges.getDeletedPaymentItemsForLoan, { loanId });
    expect(item).toMatchObject({
      kind: "reminder",
      type: "monthly_payment",
      amount: 1_000,
      dueDate: latestDueDate,
      reason: "Borrower is on a forbearance plan",
    });
    if (item.kind !== "reminder") throw new Error("Expected a reminder");
    expect(await admin.mutation(api.loanCharges.restorePaymentReminder, { id: item.id })).toEqual({ restored: true });
    expect(await remindersDueOn(admin, latestDueDate)).toHaveLength(1);

    const log = await t.run(async (ctx) => await ctx.db.query("activityLog").collect());
    expect(log.map((entry) => entry.action)).toEqual(["payment_reminder.delete", "payment_reminder.restore"]);
    expect(log[0].details).toBe(
      `Monthly payment of $1,000.00 due ${latestDueDate} · 1412 N 3rd Street, Wausau, WI\nReason: Borrower is on a forbearance plan`,
    );
  });
});
