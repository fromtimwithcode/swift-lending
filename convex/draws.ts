import { query, mutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireRole, requireAnyRole, isAdminLike } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_BULK_OPERATION_SIZE, DRAW_STATUS_LABELS, formatCurrencyPlain } from "./lib/constants";
import { validateUsDate } from "./lib/dates";
import { calculateMonthlyPaymentDue, getCurrentPrincipalOut } from "./lib/loanCalculations";

function getDrawDecisionBody(args: {
  amount: number;
  status: "approved" | "denied";
  propertyAddress?: string;
  wireDate?: string;
  adminNotes?: string;
}) {
  const statusLabel = DRAW_STATUS_LABELS[args.status]?.toLowerCase() ?? args.status;
  const propertyText = args.propertyAddress ? ` for ${args.propertyAddress}` : "";
  const wireText = args.status === "approved" && args.wireDate ? ` Wire date: ${args.wireDate}.` : "";
  const note = args.adminNotes?.trim();
  const noteText = note ? ` Note: ${note}` : "";

  return `Your draw request for ${formatCurrencyPlain(args.amount)}${propertyText} has been ${statusLabel}.${wireText}${noteText}`;
}

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
        .take(1000);
    } else {
      draws = await ctx.db.query("drawRequests").take(1000);
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

export const getDrawRequestsForLoan = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    await requireRole(ctx, "admin");

    const draws = await ctx.db
      .query("drawRequests")
      .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))
      .collect();

    const borrowerIds = [...new Set(draws.map((d) => d.borrowerId))];
    const borrowerMap = new Map(
      (await Promise.all(borrowerIds.map((id) => ctx.db.get(id)))).map((b, i) => [borrowerIds[i], b])
    );

    return draws.map((draw) => ({
      ...draw,
      borrowerName: borrowerMap.get(draw.borrowerId)?.displayName ?? "Unknown",
    }));
  },
});

export const getDrawRequest = query({
  args: { id: v.id("drawRequests") },
  handler: async (ctx, args) => {
    const profile = await requireAnyRole(ctx, ["admin", "borrower"]);
    const draw = await ctx.db.get(args.id);
    if (!draw) throw new ConvexError("Draw request not found");

    // Verify ownership or admin/developer
    if (!isAdminLike(profile.role) && draw.borrowerId !== profile._id) {
      throw new ConvexError("Not authorized");
    }

    const borrower = await ctx.db.get(draw.borrowerId);
    const loan = await ctx.db.get(draw.loanId);

    // Get documents attached to this draw using dedicated index
    const drawDocs = await ctx.db
      .query("documents")
      .withIndex("by_drawRequestId", (q) => q.eq("drawRequestId", args.id))
      .collect();
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
    wireDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");

    if (args.drawIds.length > MAX_BULK_OPERATION_SIZE) {
      throw new ConvexError(`Maximum ${MAX_BULK_OPERATION_SIZE} items per bulk operation`);
    }

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

      const loan = await ctx.db.get(draw.loanId);

      // Check fund limit before approving
      const wireDate = args.wireDate?.trim() || undefined;
      if (wireDate) validateUsDate(wireDate, "Wire date", { allowFuture: true });
      if (args.status === "approved") {
        if (!loan) {
          results.push({ drawId, success: false, error: "Loan not found" });
          continue;
        }
        const newUsed = (loan.drawFundsUsed ?? 0) + draw.amountRequested;
        if (loan.drawFundsTotal !== undefined && newUsed > loan.drawFundsTotal) {
          results.push({ drawId, success: false, error: "Would exceed fund limit" });
          continue;
        }
        await ctx.db.patch(draw.loanId, {
          drawFundsUsed: newUsed,
          monthlyPayment: calculateMonthlyPaymentDue({
            principalOut: getCurrentPrincipalOut({ ...loan, drawFundsUsed: newUsed }),
            annualRate: loan.interestRate,
            paymentType: loan.paymentType,
          }),
        });
        if (wireDate) {
          await ctx.runMutation(internal.loanCharges.recordDrawProration, {
            loanId: draw.loanId,
            drawRequestId: drawId,
            wireDate,
            createdBy: admin._id,
          });
        }
      }

      await ctx.db.patch(drawId, {
        status: args.status,
        adminNotes: args.adminNotes,
        wireDate: args.status === "approved" ? wireDate : undefined,
        reviewedBy: admin._id,
        reviewedAt: Date.now(),
      });

      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: draw.borrowerId,
        type: "draw_reviewed",
        title: "Draw Request " + (DRAW_STATUS_LABELS[args.status] ?? args.status),
        body: getDrawDecisionBody({
          amount: draw.amountRequested,
          status: args.status,
          propertyAddress: loan?.propertyAddress,
          wireDate,
          adminNotes: args.adminNotes,
        }),
        loanId: draw.loanId,
        drawRequestId: drawId,
      });

      results.push({ drawId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "draw.bulkReview",
      entityType: "draw",
      details: `Bulk ${args.status} ${successCount}/${args.drawIds.length} draw requests`,
    });

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
    wireDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    const draw = await ctx.db.get(args.id);
    if (!draw) throw new ConvexError("Draw request not found");

    if (draw.status === "approved" || draw.status === "denied") {
      throw new ConvexError(`Draw request has already been ${draw.status}`);
    }

    // If approved, check and update loan drawFundsUsed BEFORE patching draw status
    const wireDate = args.wireDate?.trim() || undefined;
    if (args.status === "approved" && !wireDate) {
      throw new ConvexError("Wire date is required to approve a draw");
    }
    if (wireDate) validateUsDate(wireDate, "Wire date", { allowFuture: true });
    if (args.status === "approved") {
      const loan = await ctx.db.get(draw.loanId);
      if (loan) {
        const newUsed = (loan.drawFundsUsed ?? 0) + draw.amountRequested;
        if (loan.drawFundsTotal !== undefined && newUsed > loan.drawFundsTotal) {
          throw new ConvexError("Draw would exceed fund limit");
        }
        await ctx.db.patch(draw.loanId, {
          drawFundsUsed: newUsed,
          monthlyPayment: calculateMonthlyPaymentDue({
            principalOut: getCurrentPrincipalOut({ ...loan, drawFundsUsed: newUsed }),
            annualRate: loan.interestRate,
            paymentType: loan.paymentType,
          }),
        });
        if (wireDate) {
          await ctx.runMutation(internal.loanCharges.recordDrawProration, {
            loanId: draw.loanId,
            drawRequestId: args.id,
            wireDate,
            createdBy: admin._id,
          });
        }
      }
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      adminNotes: args.adminNotes,
      wireDate: args.status === "approved" ? wireDate : undefined,
      reviewedBy: admin._id,
      reviewedAt: Date.now(),
    });

    // Notify borrower only for final decisions (skip under_review — intermediate step, noisy)
    if (args.status !== "under_review") {
      const loan = await ctx.db.get(draw.loanId);
      await ctx.runMutation(internal.notifications.createNotification, {
        recipientId: draw.borrowerId,
        type: "draw_reviewed",
        title: "Draw Request " + (DRAW_STATUS_LABELS[args.status] ?? args.status),
        body: getDrawDecisionBody({
          amount: draw.amountRequested,
          status: args.status,
          propertyAddress: loan?.propertyAddress,
          wireDate,
          adminNotes: args.adminNotes,
        }),
        loanId: draw.loanId,
        drawRequestId: args.id,
      });
    }

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "draw.review",
      entityType: "draw",
      entityId: args.id,
      details: `${DRAW_STATUS_LABELS[args.status] ?? args.status} draw request for ${formatCurrencyPlain(draw.amountRequested)}`,
    });

    return args.id;
  },
});
