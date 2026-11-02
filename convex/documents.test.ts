/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setup() {
  const t = convexTest(schema, modules);
  const fixture = await t.run(async (ctx) => {
    const adminUserId = await ctx.db.insert("users", { email: "documents-admin@example.com" });
    const borrowerUserId = await ctx.db.insert("users", { email: "documents-borrower@example.com" });
    const adminId = await ctx.db.insert("userProfiles", {
      authUserId: adminUserId,
      role: "admin",
      displayName: "Documents Admin",
      email: "documents-admin@example.com",
      isActive: true,
    });
    const borrowerId = await ctx.db.insert("userProfiles", {
      authUserId: borrowerUserId,
      role: "borrower",
      displayName: "Documents Borrower",
      email: "documents-borrower@example.com",
      isActive: true,
    });
    const storePdf = () => ctx.storage.store(new Blob(["statement"], { type: "application/pdf" }));
    return { adminUserId, borrowerUserId, adminId, borrowerId, fileIds: [await storePdf(), await storePdf()] };
  });
  const admin = t.withIdentity({ subject: fixture.adminUserId });
  const loanId = await admin.mutation(api.admin.createLoan, {
    borrowerId: fixture.borrowerId,
    borrowerName: "Documents Borrower",
    entityName: "Borrower LLC",
    propertyAddress: "30 Statement St, Austin, TX",
    purchasePrice: 150_000,
    loanAmount: 180_000,
    closeDate: "12/15/2026",
    interestRate: 12,
    pointsPercentage: 3,
    status: "submitted",
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
    purchaseContractFiles: [],
    missingDocumentsNote: "Contract to follow",
  });
  return {
    t,
    admin,
    borrower: t.withIdentity({ subject: fixture.borrowerUserId }),
    loanId,
    ...fixture,
  };
}

function pdf(fileId: Id<"_storage">, fileName = "statement.pdf") {
  return { fileId, fileName, fileSize: 9 };
}

describe("Other documents", () => {
  test("save the trimmed name of an Other document", async () => {
    const { admin, loanId, fileIds } = await setup();

    await admin.mutation(api.documents.saveDocuments, {
      loanId,
      documents: [{ ...pdf(fileIds[0]), type: "other", otherTypeName: "  Insurance binder  " }],
    });

    expect(await admin.query(api.documents.getDocumentsForLoan, { loanId })).toMatchObject([
      { type: "other", otherTypeName: "Insurance binder" },
    ]);
  });

  test("require a name for Other documents and only for them", async () => {
    const { admin, loanId, fileIds } = await setup();

    await expect(
      admin.mutation(api.documents.saveDocuments, {
        loanId,
        documents: [{ ...pdf(fileIds[0]), type: "other", otherTypeName: "   " }],
      })
    ).rejects.toThrow("Enter what kind of document this is.");
    await expect(
      admin.mutation(api.documents.saveDocuments, {
        loanId,
        documents: [{ ...pdf(fileIds[0]), type: "other" } as never],
      })
    ).rejects.toThrow(/Validator error/);
    await expect(
      admin.mutation(api.documents.saveDocuments, {
        loanId,
        documents: [{ ...pdf(fileIds[0]), type: "receipt", otherTypeName: "Receipt" } as never],
      })
    ).rejects.toThrow(/Validator error/);
    await expect(
      admin.mutation(api.documents.saveDocuments, {
        loanId,
        documents: [{ ...pdf(fileIds[0]), type: "other", otherTypeName: "x".repeat(101) }],
      })
    ).rejects.toThrow("Document type must be 100 characters or fewer.");
  });
});

describe("closing statements", () => {
  test("a loan keeps every closing statement until one is removed", async () => {
    const { admin, borrower, loanId, fileIds } = await setup();
    const closingStatementNames = async (viewer: typeof admin) =>
      (await viewer.query(api.documents.getDocumentsForLoan, { loanId }))
        .filter((doc) => doc.type === "closing_statement")
        .map((doc) => doc.fileName);

    await admin.mutation(api.documents.saveDocuments, {
      loanId,
      documents: fileIds.map((fileId, index) => ({
        ...pdf(fileId, `statement-${index + 1}.pdf`),
        type: "closing_statement" as const,
      })),
    });
    expect(await closingStatementNames(admin)).toEqual(["statement-1.pdf", "statement-2.pdf"]);
    expect(await closingStatementNames(borrower)).toEqual(["statement-1.pdf", "statement-2.pdf"]);

    const [first] = await admin.query(api.documents.getDocumentsForLoan, { loanId });
    await admin.mutation(api.documents.deleteDocument, { id: first._id });
    expect(await closingStatementNames(admin)).toEqual(["statement-2.pdf"]);
  });

  test("the migration moves a loan's closing statement into its documents once", async () => {
    const { t, borrower, loanId, fileIds } = await setup();
    const closerId = await t.run(async (ctx) => {
      const closerUserId = await ctx.db.insert("users", { email: "closer@example.com" });
      const id = await ctx.db.insert("userProfiles", {
        authUserId: closerUserId,
        role: "developer",
        displayName: "Closer",
        email: "closer@example.com",
        isActive: true,
      });
      await ctx.db.patch(loanId, { closingStatementFileId: fileIds[0] });
      await ctx.db.insert("activityLog", {
        userId: id,
        userName: "Closer",
        action: "loan.attachClosing",
        entityType: "loan",
        entityId: loanId,
      });
      return id;
    });

    expect(await t.mutation(internal.migrations.moveClosingStatementsToDocuments, {})).toEqual({
      moved: 1,
      missingFiles: 0,
      isDone: true,
    });
    expect(await t.mutation(internal.migrations.moveClosingStatementsToDocuments, {})).toEqual({
      moved: 0,
      missingFiles: 0,
      isDone: true,
    });

    expect(await borrower.query(api.documents.getDocumentsForLoan, { loanId })).toMatchObject([
      {
        type: "closing_statement",
        ownerId: closerId,
        fileId: fileIds[0],
        fileName: "Closing statement.pdf",
        fileSize: 9,
      },
    ]);
    expect((await t.run((ctx) => ctx.db.get(loanId)))?.closingStatementFileId).toBeUndefined();
  });

  test("the migration clears a closing statement whose file is gone", async () => {
    const { t, admin, loanId, fileIds } = await setup();
    await t.run(async (ctx) => {
      await ctx.db.patch(loanId, { closingStatementFileId: fileIds[0] });
      await ctx.storage.delete(fileIds[0]);
    });

    expect(await t.mutation(internal.migrations.moveClosingStatementsToDocuments, {})).toEqual({
      moved: 0,
      missingFiles: 1,
      isDone: true,
    });
    expect(await admin.query(api.documents.getDocumentsForLoan, { loanId })).toEqual([]);
    expect((await t.run((ctx) => ctx.db.get(loanId)))?.closingStatementFileId).toBeUndefined();
  });
});
