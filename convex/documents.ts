import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireRole, requireAnyRole, isAdminLike, getAdminLikeUsers } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_FILE_SIZE_BYTES } from "./lib/constants";

const MAX_DOCUMENT_BATCH_SIZE = 50;

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

function normalizeDocumentInput(doc: DocumentInput) {
  const fileName = doc.fileName.trim();
  if (!fileName) throw new ConvexError("Document file name cannot be empty");
  if (doc.fileSize !== undefined) {
    if (doc.fileSize < 0) throw new ConvexError("Document file size cannot be negative");
    if (doc.fileSize > MAX_FILE_SIZE_BYTES) throw new ConvexError("Document file is too large");
  }

  return { ...doc, fileName };
}

async function verifyDocumentAccess(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
  loanId: Id<"loans"> | undefined,
  drawRequestId: Id<"drawRequests"> | undefined
) {
  let loan = loanId ? await ctx.db.get(loanId) : null;

  if (profile.role === "borrower" && loanId && (!loan || loan.borrowerId !== profile._id)) {
    throw new ConvexError("Not your loan");
  }

  if (drawRequestId) {
    const draw = await ctx.db.get(drawRequestId);
    if (profile.role === "borrower" && (!draw || draw.borrowerId !== profile._id)) {
      throw new ConvexError("Not your draw request");
    }
    if (!loan && draw?.loanId) {
      loan = await ctx.db.get(draw.loanId);
    }
  }

  return loan;
}

async function notifyBorrowerDocumentUpload(
  ctx: MutationCtx,
  profile: Doc<"userProfiles">,
  loanId: Id<"loans"> | undefined,
  loan: Doc<"loans"> | null,
  documents: DocumentInput[]
) {
  if (isAdminLike(profile.role) || !loanId) return;

  const count = documents.length;
  const target = loan?.propertyAddress ?? "a loan";
  const title = count === 1 ? "New Document Uploaded" : "New Documents Uploaded";
  const body = count === 1
    ? `${profile.displayName} uploaded "${documents[0].fileName}" for ${target}.`
    : `${profile.displayName} uploaded ${count} documents for ${target}.`;
  const adminLikeUsers = await getAdminLikeUsers(ctx);

  for (const admin of adminLikeUsers) {
    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: admin._id,
      type: "document_uploaded",
      title,
      body,
      loanId,
    });
  }
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

  const documents = args.documents.map(normalizeDocumentInput);
  const loan = await verifyDocumentAccess(ctx, profile, args.loanId, args.drawRequestId);
  const ids: Id<"documents">[] = [];

  for (const doc of documents) {
    ids.push(await ctx.db.insert("documents", {
      ownerId: profile._id,
      loanId: args.loanId,
      drawRequestId: args.drawRequestId,
      type: doc.type,
      fileId: doc.fileId,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
    }));
  }

  await notifyBorrowerDocumentUpload(ctx, profile, args.loanId, loan, documents);

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

    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
      }))
    );
  },
});

export const getMyDocuments = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireRole(ctx, "borrower");

    const docs = await ctx.db
      .query("documents")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", profile._id))
      .collect();

    // Batch-load unique loans instead of N+1
    const loanIds = [...new Set(docs.filter((d) => d.loanId).map((d) => d.loanId!))];
    const loanMap = new Map(
      (await Promise.all(loanIds.map((id) => ctx.db.get(id)))).map((l, i) => [loanIds[i], l])
    );

    return await Promise.all(
      docs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
        propertyAddress: doc.loanId ? loanMap.get(doc.loanId)?.propertyAddress : undefined,
      }))
    );
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
