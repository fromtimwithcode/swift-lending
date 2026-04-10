import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireAnyRole } from "./lib/auth";
import { internal } from "./_generated/api";

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
    type: v.union(
      v.literal("articles"),
      v.literal("operating_agreement"),
      v.literal("closing_statement"),
      v.literal("wire_instructions"),
      v.literal("property_photo"),
      v.literal("receipt"),
      v.literal("lien_waiver"),
      v.literal("rehab_budget"),
      v.literal("other")
    ),
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
  },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);

    // If borrower, verify loan ownership
    if (profile.role === "borrower" && args.loanId) {
      const loan = await ctx.db.get(args.loanId);
      if (!loan || loan.borrowerId !== profile._id) {
        throw new Error("Not your loan");
      }
    }

    // If borrower provides drawRequestId, verify ownership
    if (profile.role === "borrower" && args.drawRequestId) {
      const draw = await ctx.db.get(args.drawRequestId);
      if (!draw || draw.borrowerId !== profile._id) {
        throw new Error("Not your draw request");
      }
    }

    const id = await ctx.db.insert("documents", {
      ownerId: profile._id,
      loanId: args.loanId,
      drawRequestId: args.drawRequestId,
      type: args.type,
      fileId: args.fileId,
      fileName: args.fileName,
      fileSize: args.fileSize,
    });

    // If borrower uploads a document with a loanId, notify all admins
    if (profile.role === "borrower" && args.loanId) {
      const loan = await ctx.db.get(args.loanId);
      const admins = await ctx.db
        .query("userProfiles")
        .withIndex("by_role", (q) => q.eq("role", "admin"))
        .collect();
      for (const admin of admins) {
        await ctx.runMutation(internal.notifications.createNotification, {
          recipientId: admin._id,
          type: "document_uploaded",
          title: "New Document Uploaded",
          body: `${profile.displayName} uploaded "${args.fileName}" for ${loan?.propertyAddress ?? "a loan"}.`,
          loanId: args.loanId,
        });
      }
    }

    return id;
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
        throw new Error("Not your loan");
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
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    let docs;
    if (args.loanId) {
      docs = await ctx.db
        .query("documents")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
        .collect();
    } else {
      docs = await ctx.db.query("documents").collect();
    }

    if (args.type) {
      docs = docs.filter((d) => d.type === args.type);
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
    if (!doc) throw new Error("Document not found");

    // Verify ownership or admin
    if (profile.role !== "admin" && doc.ownerId !== profile._id) {
      throw new Error("Not authorized");
    }

    await ctx.storage.delete(doc.fileId);
    await ctx.db.delete(args.id);
  },
});
