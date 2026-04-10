import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireRole, requireAnyRole } from "./lib/auth";
import { internal } from "./_generated/api";

export const getAllDrawRequests = query({
  args: {
    statusFilter: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("under_review"),
        v.literal("approved"),
        v.literal("denied")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    let draws;
    if (args.statusFilter) {
      draws = await ctx.db
        .query("drawRequests")
        .withIndex("by_status", (q) => q.eq("status", args.statusFilter!))
        .collect();
    } else {
      draws = await ctx.db.query("drawRequests").collect();
    }

    // Batch-load unique borrowers and loans instead of N+1
    const borrowerIds = [...new Set(draws.map((d) => d.borrowerId))];
    const loanIds = [...new Set(draws.map((d) => d.loanId))];
    const borrowerMap = new Map(
      (await Promise.all(borrowerIds.map((id) => ctx.db.get(id)))).map((b, i) => [borrowerIds[i], b])
    );
    const loanMap = new Map(
      (await Promise.all(loanIds.map((id) => ctx.db.get(id)))).map((l, i) => [loanIds[i], l])
    );

    return draws.map((draw) => {
      const borrower = borrowerMap.get(draw.borrowerId);
      const loan = loanMap.get(draw.loanId);
      return {
        ...draw,
        borrowerName: borrower?.displayName ?? "Unknown",
        propertyAddress: loan?.propertyAddress ?? "Unknown",
        drawFundsTotal: loan?.drawFundsTotal,
        drawFundsUsed: loan?.drawFundsUsed,
      };
    });
  },
});

export const getDrawRequest = query({
  args: { id: v.id("drawRequests") },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    const draw = await ctx.db.get(args.id);
    if (!draw) throw new Error("Draw request not found");

    // Verify ownership or admin
    if (profile.role !== "admin" && draw.borrowerId !== profile._id) {
      throw new Error("Not authorized");
    }

    const borrower = await ctx.db.get(draw.borrowerId);
    const loan = await ctx.db.get(draw.loanId);

    // Get documents attached to this draw
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_loanId", (q) => q.eq("loanId", draw.loanId))
      .collect();
    const drawDocs = documents.filter(
      (d) => d.drawRequestId === args.id
    );
    const docsWithUrls = await Promise.all(
      drawDocs.map(async (doc) => ({
        ...doc,
        url: await ctx.storage.getUrl(doc.fileId),
      }))
    );

    return {
      ...draw,
      borrowerName: borrower?.displayName ?? "Unknown",
      borrowerEmail: borrower?.email ?? "",
      propertyAddress: loan?.propertyAddress ?? "Unknown",
      loanAmount: loan?.loanAmount ?? 0,
      drawFundsTotal: loan?.drawFundsTotal,
      drawFundsUsed: loan?.drawFundsUsed,
      documents: docsWithUrls,
    };
  },
});

export const bulkReviewDrawRequests = mutation({
  args: {
    drawIds: v.array(v.id("drawRequests")),
    status: v.union(
      v.literal("approved"),
      v.literal("denied")
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    if (args.drawIds.length > 50) throw new Error("Maximum 50 items per bulk operation");

    const statusLabels: Record<string, string> = {
      approved: "Approved",
      denied: "Denied",
    };

    const results: { drawId: string; success: boolean; error?: string }[] = [];

    for (const drawId of args.drawIds) {
      const draw = await ctx.db.get(drawId);
      if (!draw) {
        results.push({ drawId, success: false, error: "Draw not found" });
        continue;
      }
      if (draw.status === "approved" || draw.status === "denied") {
        results.push({ drawId, success: false, error: `Already ${draw.status}` });
        continue;
      }

      // Check fund limit before approving
      if (args.status === "approved") {
        const loan = await ctx.db.get(draw.loanId);
        if (loan) {
          const newUsed = (loan.drawFundsUsed ?? 0) + draw.amountRequested;
          if (loan.drawFundsTotal !== undefined && newUsed > loan.drawFundsTotal) {
            results.push({ drawId, success: false, error: "Would exceed fund limit" });
            continue;
          }
          await ctx.db.patch(draw.loanId, { drawFundsUsed: newUsed });
        }
      }

      await ctx.db.patch(drawId, {
        status: args.status,
        adminNotes: args.adminNotes,
        reviewedBy: admin._id,
        reviewedAt: Date.now(),
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: draw.borrowerId,
        type: "draw_reviewed",
        title: "Draw Request " + (statusLabels[args.status] ?? args.status),
        body: `Your draw request for $${draw.amountRequested.toLocaleString()} has been ${statusLabels[args.status]?.toLowerCase() ?? args.status}.`,
        loanId: draw.loanId,
        drawRequestId: drawId,
      });

      results.push({ drawId, success: true });
    }

    return results;
  },
});

export const reviewDrawRequest = mutation({
  args: {
    id: v.id("drawRequests"),
    status: v.union(
      v.literal("under_review"),
      v.literal("approved"),
      v.literal("denied")
    ),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    const draw = await ctx.db.get(args.id);
    if (!draw) throw new Error("Draw request not found");

    if (draw.status === "approved" || draw.status === "denied") {
      throw new Error(`Draw request has already been ${draw.status}`);
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      adminNotes: args.adminNotes,
      reviewedBy: admin._id,
      reviewedAt: Date.now(),
    });

    // If approved, update loan drawFundsUsed
    if (args.status === "approved") {
      const loan = await ctx.db.get(draw.loanId);
      if (loan) {
        const newUsed = (loan.drawFundsUsed ?? 0) + draw.amountRequested;
        if (loan.drawFundsTotal !== undefined && newUsed > loan.drawFundsTotal) {
          throw new Error("Draw would exceed fund limit");
        }
        await ctx.db.patch(draw.loanId, { drawFundsUsed: newUsed });
      }
    }

    // Notify borrower of draw review
    const statusLabels: Record<string, string> = {
      under_review: "Under Review",
      approved: "Approved",
      denied: "Denied",
    };
    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: draw.borrowerId,
      type: "draw_reviewed",
      title: "Draw Request " + (statusLabels[args.status] ?? args.status),
      body: `Your draw request for $${draw.amountRequested.toLocaleString()} has been ${statusLabels[args.status]?.toLowerCase() ?? args.status}.`,
      loanId: draw.loanId,
      drawRequestId: args.id,
    });

    return args.id;
  },
});
