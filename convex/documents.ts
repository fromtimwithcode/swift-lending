import { query, mutation } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireRole, requireAnyRole, isAdminLike } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_FILE_SIZE_BYTES } from "./lib/constants";
import { notifyTeam } from "./lib/notifications";

const MAX_DOCUMENT_BATCH_SIZE = 50;
const ACCEPTED_CONTENT_TYPES_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
};
const ACCEPTED_FALLBACK_CONTENT_TYPES = new Set(["application/octet-stream"]);

const documentTypeValidator = v.union(
  v.literal("articles"),
  v.literal("operating_agreement"),
  v.literal("closing_statement"),
  v.literal("wire_instructions"),
  v.literal("property_photo"),
  v.literal("receipt"),
  v.literal("lien_waiver"),
  v.literal("rehab_budget"),
  v.literal("other")
);

const documentInputValidator = v.object({
  fileId: v.id("_storage"),
  fileName: v.string(),
  fileSize: v.optional(v.number()),
  type: documentTypeValidator,
});

type DocumentType = Doc<"documents">["type"];
type DocumentInput = {
  fileId: Id<"_storage">;
  fileName: string;
  fileSize?: number;
  type: DocumentType;
};

function getFileExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && extension !== fileName.toLowerCase() ? extension : "";
}

function normalizeDocumentInput(doc: DocumentInput) {
  const fileName = doc.fileName.trim();
  if (!fileName) throw new ConvexError("Document file name cannot be empty");
  const extension = getFileExtension(fileName);
  if (!extension || !ACCEPTED_CONTENT_TYPES_BY_EXTENSION[extension]) {
    throw new ConvexError("Unsupported document file type");
  }
  if (doc.fileSize !== undefined) {
    if (doc.fileSize < 0) throw new ConvexError("Document file size cannot be negative");
    if (doc.fileSize > MAX_FILE_SIZE_BYTES) throw new ConvexError("Document file is too large");
  }

  return { ...doc, fileName };
}

async function validateStoredDocument(ctx: MutationCtx, doc: DocumentInput) {
  const metadata = await ctx.db.system.get("_storage", doc.fileId);
  if (!metadata) throw new ConvexError("Uploaded file not found");
  if (metadata.size > MAX_FILE_SIZE_BYTES) throw new ConvexError("Document file is too large");

  const extension = getFileExtension(doc.fileName);
  const contentType = metadata.contentType?.toLowerCase();
  const acceptedContentTypes = ACCEPTED_CONTENT_TYPES_BY_EXTENSION[extension];
  if (
    contentType &&
    !acceptedContentTypes.includes(contentType) &&
    !ACCEPTED_FALLBACK_CONTENT_TYPES.has(contentType)
  ) {
    throw new ConvexError("Uploaded file content type does not match the file name");
  }

  return { ...doc, fileSize: metadata.size };
}

async function verifyDocumentAccess(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
  loanId: Id<"loans"> | undefined,
  drawRequestId: Id<"drawRequests"> | undefined
) {
  let loan = loanId ? await ctx.db.get(loanId) : null;
  let resolvedLoanId = loanId;

  if (loanId && !loan) {
    throw new ConvexError("Loan not found");
  }

  if (profile.role === "borrower" && loan && loan.borrowerId !== profile._id) {
    throw new ConvexError("Not your loan");
  }

  if (drawRequestId) {
    const draw = await ctx.db.get(drawRequestId);
    if (!draw) throw new ConvexError("Draw request not found");
    if (loanId && draw.loanId !== loanId) {
      throw new ConvexError("Draw request does not belong to this loan");
    }
    if (profile.role === "borrower" && draw.borrowerId !== profile._id) {
      throw new ConvexError("Not your draw request");
    }
    resolvedLoanId = draw.loanId;
    if (!loan || loan._id !== draw.loanId) {
      loan = await ctx.db.get(draw.loanId);
    }
    if (!loan) throw new ConvexError("Loan not found");
  }

  return { loan, loanId: resolvedLoanId };
}

async function enrichDocuments(ctx: QueryCtx, docs: Doc<"documents">[]) {
  const drawIds = [...new Set(docs.filter((doc) => doc.drawRequestId).map((doc) => doc.drawRequestId!))];
  const drawMap = new Map(
    (await Promise.all(drawIds.map((id) => ctx.db.get(id)))).map((draw, index) => [drawIds[index], draw])
  );
  const loanIds = [
    ...new Set([
      ...docs.filter((doc) => doc.loanId).map((doc) => doc.loanId!),
      ...[...drawMap.values()].filter((draw) => draw?.loanId).map((draw) => draw!.loanId),
    ]),
  ];
  const loanMap = new Map(
    (await Promise.all(loanIds.map((id) => ctx.db.get(id)))).map((loan, index) => [loanIds[index], loan])
  );

  return await Promise.all(
    docs.map(async (doc) => {
      const draw = doc.drawRequestId ? drawMap.get(doc.drawRequestId) : null;
      const loan = doc.loanId ? loanMap.get(doc.loanId) : draw ? loanMap.get(draw.loanId) : null;

      return {
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
        propertyAddress: loan?.propertyAddress,
        entityName: loan?.entityName,
        drawAmountRequested: draw?.amountRequested,
        drawWorkDescription: draw?.workDescription,
        drawStatus: draw?.status,
        drawCreatedAt: draw?._creationTime,
      };
    })
  );
}

async function notifyDocumentUpload(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
  loanId: Id<"loans"> | undefined,
  drawRequestId: Id<"drawRequests"> | undefined,
  loan: Doc<"loans"> | null,
  documents: DocumentInput[]
) {
  if (!loanId) return;

  const count = documents.length;
  const target = loan?.propertyAddress ?? "a loan";
  const title = count === 1 ? "New Document Uploaded" : "New Documents Uploaded";
  const uploadSummary = count === 1
    ? `${profile.displayName} uploaded "${documents[0].fileName}" for ${target}.`
    : `${profile.displayName} uploaded ${count} documents for ${target}.`;

  if (isAdminLike(profile.role)) {
    if (!loan) return;

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: loan.borrowerId,
      type: "document_uploaded",
      title,
      body: count === 1
        ? `A new document, "${documents[0].fileName}", was uploaded for ${target}.`
        : `${count} new documents were uploaded for ${target}.`,
      loanId,
      drawRequestId,
      sendSms: true,
    });

    await notifyTeam(ctx, {
      type: "document_uploaded",
      title,
      body: uploadSummary,
      loanId,
      drawRequestId,
      details: [
        { label: "Borrower", value: loan.borrowerName },
        { label: "Property address", value: target },
        { label: "Uploaded by", value: profile.displayName },
        { label: "Document count", value: String(count) },
      ],
      actionPath: drawRequestId ? `/dashboard/admin/draws/${drawRequestId}` : `/dashboard/admin/loans/${loanId}`,
      actionLabel: "View Documents",
      sendSms: true,
    });
    return;
  }

  await notifyTeam(ctx, {
    type: "document_uploaded",
    title,
    body: uploadSummary,
    loanId,
    drawRequestId,
    details: [
      { label: "Borrower", value: profile.displayName },
      { label: "Property address", value: target },
      { label: "Document count", value: String(count) },
    ],
    actionPath: drawRequestId ? `/dashboard/admin/draws/${drawRequestId}` : `/dashboard/admin/loans/${loanId}`,
    actionLabel: "View Documents",
    sendSms: true,
    sendExternalEmail: true,
  });
}

async function saveDocumentBatch(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
  args: {
    documents: DocumentInput[];
    loanId?: Id<"loans">;
    drawRequestId?: Id<"drawRequests">;
  }
) {
  if (args.documents.length === 0) throw new ConvexError("Select at least one document");
  if (args.documents.length > MAX_DOCUMENT_BATCH_SIZE) {
    throw new ConvexError(`Upload up to ${MAX_DOCUMENT_BATCH_SIZE} documents at a time`);
  }

  const documents = await Promise.all(
    args.documents.map((doc) => validateStoredDocument(ctx, normalizeDocumentInput(doc)))
  );
  const access = await verifyDocumentAccess(ctx, profile, args.loanId, args.drawRequestId);
  const ids: Id<"documents">[] = [];

  for (const doc of documents) {
    ids.push(await ctx.db.insert("documents", {
      ownerId: profile._id,
      loanId: access.loanId,
      drawRequestId: args.drawRequestId,
      type: doc.type,
      fileId: doc.fileId,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
    }));
  }

  await notifyDocumentUpload(ctx, profile, access.loanId, args.drawRequestId, access.loan, documents);

  return ids;
}

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAnyRole(ctx, ["admin", "borrower"]);
    return await ctx.storage.generateUploadUrl();
  },
});

export const saveDocument = mutation({
  args: {
    fileId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.optional(v.number()),
    type: documentTypeValidator,
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
  },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    const ids = await saveDocumentBatch(ctx, profile, {
      documents: [{
        fileId: args.fileId,
        fileName: args.fileName,
        fileSize: args.fileSize,
        type: args.type,
      }],
      loanId: args.loanId,
      drawRequestId: args.drawRequestId,
    });

    return ids[0];
  },
});

export const saveDocuments = mutation({
  args: {
    documents: v.array(documentInputValidator),
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
  },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    return await saveDocumentBatch(ctx, profile, args);
  },
});

export const discardUnsavedUploads = mutation({
  args: {
    fileIds: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireAnyRole(ctx, ["admin", "borrower"]);
    if (args.fileIds.length > MAX_DOCUMENT_BATCH_SIZE) {
      throw new ConvexError(`Discard up to ${MAX_DOCUMENT_BATCH_SIZE} uploaded files at a time`);
    }

    for (const fileId of [...new Set(args.fileIds)]) {
      const savedDocument = await ctx.db
        .query("documents")
        .withIndex("by_fileId", (q) => q.eq("fileId", fileId))
        .first();
      if (!savedDocument) await ctx.storage.delete(fileId);
    }
  },
});

export const getDocumentsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);

    // Verify access
    if (profile.role === "borrower") {
      const loan = await ctx.db.get(args.loanId);
      if (!loan || loan.borrowerId !== profile._id) {
        throw new ConvexError("Not your loan");
      }
    }

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();

    return await enrichDocuments(ctx, docs);
  },
});

export const getMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "borrower");

    const ownedDocs = await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", profile._id))
      .collect();
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", profile._id))
      .collect();
    const loanDocs = (
      await Promise.all(
        loans.map((loan) =>
          ctx.db
            .query("documents")
            .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
            .collect()
        )
      )
    ).flat();
    const docs = Array.from(new Map([...ownedDocs, ...loanDocs].map((doc) => [doc._id, doc])).values());

    return (await enrichDocuments(ctx, docs)).map((doc) => ({
      ...doc,
      canDelete: doc.ownerId === profile._id,
    }));
  },
});

export const getAllDocuments = query({
  args: {
    loanId: v.optional(v.id("loans")),
    type: v.optional(documentTypeValidator),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    let docs;
    if (args.loanId && args.type) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_loanId_and_type", (q) =>
          q.eq("loanId", args.loanId).eq("type", args.type!)
        )
        .collect();
    } else if (args.loanId) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .collect();
    } else if (args.type) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_type", (q) => q.eq("type", args.type!))
        .take(1000);
    } else {
      docs = await ctx.db.query("documents").take(1000);
    }

    // Batch-load unique owners and loans instead of N+1
    const ownerIds = [...new Set(docs.map((d) => d.ownerId))];
    const loanIds = [...new Set(docs.filter((d) => d.loanId).map((d) => d.loanId!))];
    const ownerMap = new Map(
      (await Promise.all(ownerIds.map((id) => ctx.db.get(id)))).map((o, i) => [ownerIds[i], o])
    );
    const loanMap = new Map(
      (await Promise.all(loanIds.map((id) => ctx.db.get(id)))).map((l, i) => [loanIds[i], l])
    );

    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
        ownerName: ownerMap.get(doc.ownerId)?.displayName ?? "Unknown",
        propertyAddress: doc.loanId ? loanMap.get(doc.loanId)?.propertyAddress : undefined,
      }))
    );
  },
});

export const deleteDocument = mutation({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    const doc = await ctx.db.get(args.id);
    if (!doc) throw new ConvexError("Document not found");

    // Verify ownership or admin/developer
    if (!isAdminLike(profile.role) && doc.ownerId !== profile._id) {
      throw new ConvexError("Not authorized");
    }

    await ctx.storage.delete(doc.fileId);
    await ctx.db.delete(args.id);

    await ctx.runMutation(internal.activityLog.log, {
      userId: profile._id,
      userName: profile.displayName,
      action: "document.delete",
      entityType: "document",
      entityId: args.id,
      details: `Deleted document "${doc.fileName}"`,
    });
  },
});
