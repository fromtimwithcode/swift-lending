import { v, ConvexError, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export const MAX_PURCHASE_CONTRACT_FILES = 20;
export const MAX_MISSING_DOCUMENTS_NOTE_LENGTH = 2_000;

export const purchaseContractFilesValidator = v.array(v.object({
  storageId: v.id("_storage"),
  fileName: v.string(),
  fileSize: v.optional(v.number()),
}));

export function normalizeMissingDocumentsNote(note: string | undefined) {
  const trimmed = note?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_MISSING_DOCUMENTS_NOTE_LENGTH) {
    throw new ConvexError(
      `Missing documents note must be ${MAX_MISSING_DOCUMENTS_NOTE_LENGTH.toLocaleString("en-US")} characters or fewer`
    );
  }
  return trimmed;
}

export async function insertPurchaseContracts(
  ctx: MutationCtx,
  {
    ownerId,
    loanId,
    files,
  }: {
    ownerId: Id<"userProfiles">;
    loanId: Id<"loans">;
    files: Infer<typeof purchaseContractFilesValidator>;
  }
) {
  if (files.length > MAX_PURCHASE_CONTRACT_FILES) {
    throw new ConvexError(`Maximum ${MAX_PURCHASE_CONTRACT_FILES} purchase contract files allowed`);
  }
  for (const file of files) {
    const fileName = file.fileName.trim();
    if (!fileName) throw new ConvexError("Document file name cannot be empty");
    if (file.fileSize !== undefined && file.fileSize < 0) {
      throw new ConvexError("Document file size cannot be negative");
    }
    await ctx.db.insert("documents", {
      ownerId,
      loanId,
      type: "purchase_contract",
      fileId: file.storageId,
      fileName,
      fileSize: file.fileSize,
    });
  }
}

const CLOSING_STATEMENT_EXTENSIONS: Record<string, string> = {
  "application/pdf": "pdf",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export function getUnnamedClosingStatementFileName(contentType: string | undefined) {
  return `Closing statement.${CLOSING_STATEMENT_EXTENSIONS[contentType ?? ""] ?? "pdf"}`;
}

export function getNewestClosingStatement(ctx: QueryCtx, loanId: Id<"loans">) {
  return ctx.db
    .query("documents")
    .withIndex("by_loanId_and_type", (q) => q.eq("loanId", loanId).eq("type", "closing_statement"))
    .order("desc")
    .first();
}
