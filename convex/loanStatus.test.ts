/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { getErrorMessage } from "../lib/errors";
import {
  getNextLoanStatuses,
  LOAN_STATUSES,
  type LoanStatus,
} from "./lib/loanStatus";

const modules = import.meta.glob("./**/*.ts");
async function fixture(
  status: LoanStatus = "under_review",
  role: "admin" | "developer" | "borrower" = "admin",
) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      email: "reviewer@example.com",
    });
    const reviewerId = await ctx.db.insert("userProfiles", {
      authUserId: userId,
      role,
      displayName: "Reviewer",
      email: "reviewer@example.com",
      isActive: true,
    });
    const borrowerUserId = await ctx.db.insert("users", {
      email: "borrower@example.com",
    });
    const borrowerId = await ctx.db.insert("userProfiles", {
      authUserId: borrowerUserId,
      role: "borrower",
      displayName: "Borrower",
      email: "borrower@example.com",
      isActive: true,
      phone: "+15555551234",
    });
    const loanId = await ctx.db.insert("loans", {
      borrowerId,
      borrowerName: "Borrower",
      entityName: "Borrower LLC",
      propertyAddress: "100 Example Avenue",
      purchasePrice: 100000,
      loanAmount: 100000,
      terms: "Test",
      interestRate: 12,
      monthlyPayment: 1000,
      pointsEarned: 3000,
      status,
      createdBy: reviewerId,
      notes: "General loan notes",
    });
    return { userId, reviewerId, borrowerUserId, borrowerId, loanId };
  });
  return {
    t,
    admin: t.withIdentity({ subject: ids.userId }),
    borrower: t.withIdentity({ subject: ids.borrowerUserId }),
    ...ids,
  };
}

describe("loan status feedback", () => {
  test.each(["under_review", "additional_info_needed"] as const)(
    "approves directly from %s",
    async (status) => {
      const { admin, borrower, loanId } = await fixture(status);
      await admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "approved",
        expectedStatus: status,
      });
      expect(
        (await borrower.query(api.borrower.getMyLoan, { id: loanId })).status,
      ).toBe("approved");
    },
  );

  test.each(["additional_info_needed", "denied"] as const)(
    "requires a nonblank explanation for %s without side effects",
    async (status) => {
      const { t, admin, loanId } = await fixture();
      for (const note of [undefined, "", " \n "]) {
        await expect(
          admin.mutation(api.admin.updateLoanStatus, {
            id: loanId,
            status,
            note,
          }),
        ).rejects.toThrow();
      }
      const state = await t.run(async (ctx) => ({
        loan: await ctx.db.get(loanId),
        notifications: await ctx.db.query("notifications").collect(),
        log: await ctx.db.query("activityLog").collect(),
      }));
      expect(state.loan?.status).toBe("under_review");
      expect(state.notifications).toHaveLength(0);
      expect(state.log).toHaveLength(0);
    },
  );

  test("persists borrower-visible notes, authorship, notifications, and historical explanations", async () => {
    const { t, admin, borrower, loanId, reviewerId, borrowerId } =
      await fixture();
    const note =
      "Please provide:\n• Updated scope of work\n• Proof of insurance";
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "additional_info_needed",
      note: `  ${note}  `,
    });
    const loan = await borrower.query(api.borrower.getMyLoan, { id: loanId });
    expect(loan).toMatchObject({
      statusNote: note,
      statusUpdatedBy: reviewerId,
      statusUpdatedAt: expect.any(Number),
      notes: "General loan notes",
    });
    const notices = await borrower.query(
      api.notifications.getMyNotifications,
      {},
    );
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ recipientId: borrowerId, loanId });
    expect(notices[0].body).toContain(note);
    const jobs = await t.run(
      async (ctx) =>
        await ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      jobs.some((job) =>
        JSON.stringify(job.args).includes(note.replaceAll("\n", "\\n")),
      ),
    ).toBe(true);
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "approved",
    });
    expect(
      (await borrower.query(api.borrower.getMyLoan, { id: loanId })).statusNote,
    ).toBeUndefined();
    const history = await admin.query(api.activityLog.getActivityForEntity, {
      entityId: loanId,
    });
    expect(history).toHaveLength(2);
    expect(
      history.find((entry) => entry.details?.includes(note)),
    ).toMatchObject({ userId: reviewerId, userName: "Reviewer" });
  });

  test("repeated saves do not replace notes or repeat alerts/audit entries", async () => {
    const { t, admin, loanId } = await fixture();
    const args = {
      id: loanId,
      status: "denied" as const,
      expectedStatus: "under_review" as const,
      note: "Insufficient collateral",
    };
    await admin.mutation(api.admin.updateLoanStatus, args);
    const before = await t.run(async (ctx) => ({
      notifications: await ctx.db.query("notifications").collect(),
      logs: await ctx.db.query("activityLog").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    await admin.mutation(api.admin.updateLoanStatus, { ...args, note: "" });
    const after = await t.run(async (ctx) => ({
      notifications: await ctx.db.query("notifications").collect(),
      logs: await ctx.db.query("activityLog").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
    expect(after).toEqual(before);
    expect(
      (await t.run(async (ctx) => await ctx.db.get(loanId)))?.statusNote,
    ).toBe(args.note);
  });

  test("rejects a stale dialog even when its target would otherwise be allowed", async () => {
    const { admin, borrower, loanId } = await fixture();
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "additional_info_needed",
      note: "Insurance",
    });
    await expect(
      admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "approved",
        expectedStatus: "under_review",
      }),
    ).rejects.toThrow("while you were reviewing");
    expect(
      (await borrower.query(api.borrower.getMyLoan, { id: loanId })).status,
    ).toBe("additional_info_needed");
    try {
      await admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "approved",
        expectedStatus: "under_review",
      });
    } catch (error) {
      expect(getErrorMessage(error)).toContain("while you were reviewing");
    }
  });

  test("lets any open status move to any other status, except funded loans to Canceled", () => {
    for (const status of LOAN_STATUSES.filter((item) => item !== "closed")) {
      const funded = status === "funded" || status === "sent_to_title";
      expect(getNextLoanStatuses({ status })).toEqual(
        LOAN_STATUSES.filter(
          (item) => item !== status && !(funded && item === "canceled"),
        ),
      );
    }
  });

  test.each([
    ["sent_to_title", undefined],
    ["additional_info_needed", "Updated title commitment"],
    ["submitted", undefined],
  ] as const)(
    "moves an approved loan to %s",
    async (status, note) => {
      const { admin, borrower, loanId } = await fixture("approved");
      await admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status,
        note,
        expectedStatus: "approved",
      });
      expect(
        (await borrower.query(api.borrower.getMyLoan, { id: loanId })).status,
      ).toBe(status);
    },
  );

  test("remembers the timeline step a loan was on while it is held", async () => {
    const { admin, borrower, loanId } = await fixture("funded");
    const moveTo = async (status: LoanStatus) => {
      await admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status,
        note: "Upload the renewed insurance policy.",
      });
      return (await borrower.query(api.borrower.getMyLoan, { id: loanId })).progressStatus;
    };

    expect(await moveTo("additional_info_needed")).toBe("funded");
    expect(await moveTo("denied")).toBe("funded");
    expect(await moveTo("sent_to_title")).toBeUndefined();
  });

  test("rejects leaving closed and returned loans", async () => {
    const { t, admin, loanId } = await fixture("closed");
    expect(getNextLoanStatuses({ status: "closed" })).toEqual([]);
    await expect(
      admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "under_review",
      }),
    ).rejects.toThrow("Cannot move from Closed to Under Review.");
    await t.run(
      async (ctx) =>
        await ctx.db.patch(loanId, {
          status: "closed",
          returnedDate: "09/20/2026",
        }),
    );
    await expect(
      admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "under_review",
      }),
    ).rejects.toThrow("funds have been marked returned");
  });

  test("clears a prior status note when funds are returned", async () => {
    const { t, admin, loanId } = await fixture("funded");
    await t.run(
      async (ctx) =>
        await ctx.db.patch(loanId, { statusNote: "Wire is on its way" }),
    );
    await admin.mutation(api.admin.recordLoanReturned, {
      id: loanId,
      returnedDate: "09/20/2026",
      returnedAmount: 100000,
    });
    expect(await t.run(async (ctx) => await ctx.db.get(loanId))).toMatchObject({
      status: "closed",
      statusUpdatedAt: expect.any(Number),
    });
    expect(
      (await t.run(async (ctx) => await ctx.db.get(loanId)))?.statusNote,
    ).toBeUndefined();
  });

  test("enforces note length on the server", async () => {
    const { admin, loanId } = await fixture();
    await expect(
      admin.mutation(api.admin.updateLoanStatus, {
        id: loanId,
        status: "denied",
        note: "x".repeat(2001),
      }),
    ).rejects.toThrow("2,000");
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "denied",
      note: "x".repeat(2000),
    });
  });

  test.each(["admin", "developer"] as const)(
    "allows %s to update status",
    async (role) => {
      const { admin, loanId } = await fixture("under_review", role);
      await expect(
        admin.mutation(api.admin.updateLoanStatus, {
          id: loanId,
          status: "approved",
        }),
      ).resolves.toBe(loanId);
    },
  );

  test("rejects borrower and unauthenticated status writes, including bulk", async () => {
    const { t, admin, loanId } = await fixture("under_review", "borrower");
    for (const client of [t, admin]) {
      await expect(
        client.mutation(api.admin.updateLoanStatus, {
          id: loanId,
          status: "approved",
        }),
      ).rejects.toThrow();
      await expect(
        client.mutation(api.admin.bulkUpdateLoanStatus, {
          loanIds: [loanId],
          status: "approved",
        }),
      ).rejects.toThrow();
    }
  });
});

describe("bulk loan status feedback", () => {
  test("updates eligible loans with notes and per-loan audit history, reports failures, deduplicates IDs", async () => {
    const { t, admin, loanId } = await fixture();
    const closedId = await t.run(async (ctx) => {
      const loan = (await ctx.db.get(loanId))!;
      const { _id, _creationTime, ...fields } = loan;
      void _id;
      void _creationTime;
      return await ctx.db.insert("loans", {
        ...fields,
        status: "closed",
        propertyAddress: "200 Closed Street",
      });
    });
    const results = await admin.mutation(api.admin.bulkUpdateLoanStatus, {
      loanIds: [loanId, loanId, closedId],
      status: "denied",
      note: "Insufficient collateral",
    });
    expect(results).toEqual([
      { loanId, success: true, changed: true },
      {
        loanId: closedId,
        success: false,
        error: "Cannot move from Closed to Denied.",
      },
    ]);
    expect(
      (await t.run(async (ctx) => await ctx.db.get(loanId)))?.statusNote,
    ).toBe("Insufficient collateral");
    const history = await admin.query(api.activityLog.getActivityForEntity, {
      entityId: loanId,
    });
    expect(history).toHaveLength(1);
    expect(history[0].details).toContain("Insufficient collateral");
    expect(
      await admin.query(api.activityLog.getActivityForEntity, {
        entityId: closedId,
      }),
    ).toHaveLength(0);
  });

  test("bulk requires reasons and respects stale snapshots", async () => {
    const { admin, loanId } = await fixture();
    expect(
      await admin.mutation(api.admin.bulkUpdateLoanStatus, {
        loanIds: [loanId],
        status: "additional_info_needed",
        note: "  ",
      }),
    ).toMatchObject([
      { success: false, error: "Describe the information still needed." },
    ]);
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "additional_info_needed",
      note: "Insurance",
    });
    expect(
      await admin.mutation(api.admin.bulkUpdateLoanStatus, {
        loanIds: [loanId],
        status: "approved",
        expectedStatuses: [{ loanId, status: "under_review" }],
      }),
    ).toMatchObject([
      {
        success: false,
        error: expect.stringContaining("while you were reviewing"),
      },
    ]);
    expect(
      await admin.mutation(api.admin.bulkUpdateLoanStatus, {
        loanIds: [loanId],
        status: "approved",
        expectedStatuses: [{ loanId, status: "additional_info_needed" }],
      }),
    ).toMatchObject([{ success: true, changed: true }]);
  });

  test("bulk no-ops send no alerts and create no audit entries", async () => {
    const { t, admin, loanId } = await fixture("approved");
    expect(
      await admin.mutation(api.admin.bulkUpdateLoanStatus, {
        loanIds: [loanId],
        status: "approved",
      }),
    ).toMatchObject([{ success: true, changed: false }]);
    expect(
      await t.run(async (ctx) => await ctx.db.query("notifications").collect()),
    ).toHaveLength(0);
    expect(
      await t.run(async (ctx) => await ctx.db.query("activityLog").collect()),
    ).toHaveLength(0);
  });
});

describe("canceling loan applications", () => {
  async function snapshot(t: Awaited<ReturnType<typeof fixture>>["t"]) {
    return await t.run(async (ctx) => ({
      notifications: await ctx.db.query("notifications").collect(),
      logs: await ctx.db.query("activityLog").collect(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
    }));
  }

  test.each([
    "submitted",
    "under_review",
    "additional_info_needed",
    "approved",
    "denied",
  ] as const)("admins can cancel a %s loan without a reason", async (status) => {
    const { admin, borrower, loanId } = await fixture(status);
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "canceled",
      expectedStatus: status,
    });
    const loan = await borrower.query(api.borrower.getMyLoan, { id: loanId });
    expect(loan.status).toBe("canceled");
    expect(loan.statusNote).toBeUndefined();
    const [notice] = await borrower.query(api.notifications.getMyNotifications, {});
    expect(notice.body).toContain('"Canceled"');
  });

  test("admins can reopen a canceled loan", async () => {
    const { admin, borrower, loanId } = await fixture("approved");
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "canceled",
      note: "Duplicate application",
    });
    expect(
      (await borrower.query(api.borrower.getMyLoan, { id: loanId })).progressStatus,
    ).toBe("approved");
    await admin.mutation(api.admin.updateLoanStatus, {
      id: loanId,
      status: "under_review",
      expectedStatus: "canceled",
    });
    const loan = await borrower.query(api.borrower.getMyLoan, { id: loanId });
    expect(loan.status).toBe("under_review");
    expect(loan.statusNote).toBeUndefined();
  });

  test.each(["funded", "sent_to_title"] as const)(
    "rejects canceling a %s loan",
    async (status) => {
      const { admin, loanId } = await fixture(status);
      await expect(
        admin.mutation(api.admin.updateLoanStatus, { id: loanId, status: "canceled" }),
      ).rejects.toThrow("Funded loans can't be canceled.");
      expect(
        await admin.mutation(api.admin.bulkUpdateLoanStatus, {
          loanIds: [loanId],
          status: "canceled",
        }),
      ).toMatchObject([
        { success: false, error: expect.stringContaining("Funded loans can't be canceled.") },
      ]);
    },
  );

  test("rejects canceling a loan with approved draws", async () => {
    const { t, admin, borrower, loanId } = await fixture("approved");
    await t.run(async (ctx) => await ctx.db.patch(loanId, { drawFundsUsed: 5000 }));
    expect(getNextLoanStatuses({ status: "approved", drawFundsUsed: 5000 })).not.toContain(
      "canceled",
    );
    await expect(
      admin.mutation(api.admin.updateLoanStatus, { id: loanId, status: "canceled" }),
    ).rejects.toThrow("approved draws");
    await expect(
      borrower.mutation(api.borrower.cancelApplication, { id: loanId }),
    ).rejects.toThrow("approved draws");
  });

  test("borrowers can cancel their own application with a reason", async () => {
    const { t, admin, borrower, loanId, borrowerId } = await fixture("under_review");
    await borrower.mutation(api.borrower.cancelApplication, {
      id: loanId,
      note: "  Deal fell through\n\nThe seller accepted another offer.  ",
    });
    const loan = await borrower.query(api.borrower.getMyLoan, { id: loanId });
    expect(loan).toMatchObject({
      status: "canceled",
      statusNote: "Deal fell through\n\nThe seller accepted another offer.",
      statusUpdatedBy: borrowerId,
      progressStatus: "under_review",
    });
    const [borrowerNotice] = await borrower.query(api.notifications.getMyNotifications, {});
    expect(borrowerNotice.body).toContain("The seller accepted another offer.");
    const [teamNotice] = await admin.query(api.notifications.getMyNotifications, {});
    expect(teamNotice).toMatchObject({
      title: "Loan Application Canceled",
      body: expect.stringContaining("Borrower canceled their loan application"),
    });
    const [entry] = await admin.query(api.activityLog.getActivityForEntity, {
      entityId: loanId,
    });
    expect(entry).toMatchObject({ userId: borrowerId, action: "loan.status" });
    expect(await admin.query(api.admin.getApplications, {})).toHaveLength(0);
    expect((await admin.query(api.admin.getOverviewStats, {})).pendingLoans).toBe(0);

    const before = await snapshot(t);
    await borrower.mutation(api.borrower.cancelApplication, { id: loanId, note: "Again" });
    expect(await snapshot(t)).toEqual(before);
  });

  test.each(["denied", "funded", "closed"] as const)(
    "borrowers cannot cancel a %s loan",
    async (status) => {
      const { t, borrower, loanId } = await fixture(status);
      const before = await snapshot(t);
      await expect(
        borrower.mutation(api.borrower.cancelApplication, { id: loanId }),
      ).rejects.toThrow("can no longer be canceled");
      expect(await snapshot(t)).toEqual(before);
      expect(
        (await t.run(async (ctx) => await ctx.db.get(loanId)))?.status,
      ).toBe(status);
    },
  );

  test("only the loan's borrower can cancel it", async () => {
    const { t, admin, borrower, loanId } = await fixture();
    const otherUserId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", { email: "other@example.com" });
      await ctx.db.insert("userProfiles", {
        authUserId: userId,
        role: "borrower",
        displayName: "Other Borrower",
        email: "other@example.com",
        isActive: true,
      });
      return userId;
    });
    for (const client of [t, admin, t.withIdentity({ subject: otherUserId })]) {
      await expect(
        client.mutation(api.borrower.cancelApplication, { id: loanId }),
      ).rejects.toThrow();
    }
    await expect(
      borrower.mutation(api.borrower.cancelApplication, {
        id: loanId,
        note: "x".repeat(2001),
      }),
    ).rejects.toThrow("2,000");
    expect(
      (await t.run(async (ctx) => await ctx.db.get(loanId)))?.status,
    ).toBe("under_review");
  });
});

describe("overview loan counts", () => {
  test("pending loans have no money out; active loans are the ones with money out", async () => {
    const { t, admin, loanId } = await fixture("under_review");
    await t.run(async (ctx) => {
      const { _id, _creationTime, ...fields } = (await ctx.db.get(loanId))!;
      void _id;
      void _creationTime;
      for (const status of ["submitted", "approved", "funded", "sent_to_title", "closed", "denied", "canceled"] as const) {
        await ctx.db.insert("loans", { ...fields, status });
      }
      await ctx.db.insert("loans", { ...fields, status: "closed", returnedDate: "09/20/2026" });
    });
    expect(await admin.query(api.admin.getOverviewStats, {})).toMatchObject({
      totalLoans: 9,
      pendingLoans: 3,
      activeLoans: 3,
      returnedLoans: 1,
    });
  });
});
