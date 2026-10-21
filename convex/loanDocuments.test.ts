/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const adminUserId = await ctx.db.insert("users", { email: "docs-admin@example.com" });
    const borrowerUserId = await ctx.db.insert("users", { email: "docs-borrower@example.com" });
    const adminId = await ctx.db.insert("userProfiles", {
      authUserId: adminUserId,
      role: "admin",
      displayName: "Docs Admin",
      email: "docs-admin@example.com",
      isActive: true,
    });
    const borrowerId = await ctx.db.insert("userProfiles", {
      authUserId: borrowerUserId,
      role: "borrower",
      displayName: "Docs Borrower",
      email: "docs-borrower@example.com",
      isActive: true,
    });
    const contractFileId = await ctx.storage.store(new Blob(["contract"], { type: "application/pdf" }));
    const photoFileId = await ctx.storage.store(new Blob(["photo"], { type: "image/png" }));
    return { adminUserId, borrowerUserId, adminId, borrowerId, contractFileId, photoFileId };
  });
  return {
    t,
    admin: t.withIdentity({ subject: fixture.adminUserId }),
    borrower: t.withIdentity({ subject: fixture.borrowerUserId }),
    ...fixture,
  };
}

function applicationArgs(photoFileId: Id<"_storage">) {
  return {
    entityName: "Borrower LLC",
    propertyAddress: "20 Contract St, Austin, TX",
    purchasePrice: 150_000,
    loanAmount: 180_000,
    afterRepairValue: 250_000,
    rehabBudgetTotal: 30_000,
    terms: "12 months",
    titleCompanyName: "Test Title",
    titleCompanyContact: "Title Contact",
    titleCompanyContactEmail: "title@example.com",
    titleCompanyContactPhone: "555-555-1212",
    desiredCloseDate: "12/15/2026",
    strategy: "flip_and_resell" as const,
    propertyType: "condo" as const,
    bedrooms: 2,
    bathrooms: 2,
    squareFeetAboveGrade: 1_100,
    squareFeetBelowGrade: 0,
    unitDetails: [],
    photoFileIds: [{ storageId: photoFileId, fileName: "front.png" }],
  };
}

function adminLoanArgs(borrowerId: Id<"userProfiles">) {
  return {
    borrowerId,
    borrowerName: "Docs Borrower",
    entityName: "Borrower LLC",
    propertyAddress: "21 Contract St, Austin, TX",
    purchasePrice: 150_000,
    loanAmount: 180_000,
    closeDate: "12/15/2026",
    terms: "12 months",
    interestRate: 12,
    pointsPercentage: 3,
    status: "submitted" as const,
    titleCompany: "Test Title",
    titleCompanyContact: "Title Contact",
    titleCompanyContactEmail: "title@example.com",
    titleCompanyContactPhone: "555-555-1212",
    strategy: "flip_and_resell" as const,
    propertyType: "single_family" as const,
    bedrooms: 3,
    bathrooms: 2,
    squareFeetAboveGrade: 1_500,
    squareFeetBelowGrade: 0,
    unitDetails: [],
  };
}

async function getLoanState(t: Awaited<ReturnType<typeof setup>>["t"], loanId: Id<"loans">) {
  return await t.run(async (ctx) => ({
    loan: await ctx.db.get(loanId),
    purchaseContracts: await ctx.db
      .query("documents")
      .withIndex("by_loanId_and_type", (q) => q.eq("loanId", loanId).eq("type", "purchase_contract"))
      .collect(),
  }));
}

describe("borrower applications", () => {
  test("reject an application without a purchase contract", async () => {
    const { borrower, photoFileId } = await setup();

    await expect(
      borrower.mutation(api.borrower.submitApplication, {
        ...applicationArgs(photoFileId),
        purchaseContractFiles: [],
      })
    ).rejects.toThrow("A purchase contract is required");
  });

  test("save the purchase contract with the application", async () => {
    const { t, borrower, borrowerId, photoFileId, contractFileId } = await setup();

    const loanId = await borrower.mutation(api.borrower.submitApplication, {
      ...applicationArgs(photoFileId),
      purchaseContractFiles: [{ storageId: contractFileId, fileName: " contract.pdf ", fileSize: 8 }],
    });

    const state = await getLoanState(t, loanId);
    expect(state.loan).toMatchObject({ isUnderContract: true, propertyType: "condo" });
    expect(state.loan?.missingDocumentsNote).toBeUndefined();
    expect(state.purchaseContracts).toMatchObject([
      { ownerId: borrowerId, fileId: contractFileId, fileName: "contract.pdf", fileSize: 8 },
    ]);
  });
});

describe("admin-created loans", () => {
  test("require a purchase contract or a missing documents note", async () => {
    const { admin, borrowerId } = await setup();

    await expect(
      admin.mutation(api.admin.createLoan, {
        ...adminLoanArgs(borrowerId),
        purchaseContractFiles: [],
        missingDocumentsNote: "   ",
      })
    ).rejects.toThrow("Upload the purchase contract or list the missing documents");
  });

  test("record the missing documents note when no contract is uploaded", async () => {
    const { t, admin, borrowerId } = await setup();

    const loanId = await admin.mutation(api.admin.createLoan, {
      ...adminLoanArgs(borrowerId),
      purchaseContractFiles: [],
      missingDocumentsNote: "  Missing purchase contract  ",
    });

    const state = await getLoanState(t, loanId);
    expect(state.loan?.missingDocumentsNote).toBe("Missing purchase contract");
    expect(state.purchaseContracts).toEqual([]);
  });

  test("save an uploaded purchase contract without a note", async () => {
    const { t, admin, adminId, borrowerId, contractFileId } = await setup();

    const loanId = await admin.mutation(api.admin.createLoan, {
      ...adminLoanArgs(borrowerId),
      purchaseContractFiles: [{ storageId: contractFileId, fileName: "contract.pdf" }],
    });

    const state = await getLoanState(t, loanId);
    expect(state.loan?.missingDocumentsNote).toBeUndefined();
    expect(state.purchaseContracts).toMatchObject([
      { ownerId: adminId, fileId: contractFileId, fileName: "contract.pdf" },
    ]);
  });

  test("let admins edit and clear the missing documents note", async () => {
    const { t, admin, borrowerId } = await setup();
    const loanId = await admin.mutation(api.admin.createLoan, {
      ...adminLoanArgs(borrowerId),
      purchaseContractFiles: [],
      missingDocumentsNote: "Missing purchase contract and operating agreement",
    });

    await admin.mutation(api.admin.updateLoan, {
      id: loanId,
      missingDocumentsNote: "Missing operating agreement",
    });
    expect((await getLoanState(t, loanId)).loan?.missingDocumentsNote)
      .toBe("Missing operating agreement");

    await admin.mutation(api.admin.updateLoan, { id: loanId, missingDocumentsNote: "" });
    expect((await getLoanState(t, loanId)).loan?.missingDocumentsNote).toBeUndefined();
  });

  test("reject an overlong missing documents note", async () => {
    const { admin, borrowerId } = await setup();

    await expect(
      admin.mutation(api.admin.createLoan, {
        ...adminLoanArgs(borrowerId),
        purchaseContractFiles: [],
        missingDocumentsNote: "x".repeat(2_001),
      })
    ).rejects.toThrow("Missing documents note must be 2,000 characters or fewer");
  });
});
