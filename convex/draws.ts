import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { requireRole, requireAnyRole, isAdminLike } from "./lib/auth";
import { internal } from "./_generated/api";
import { MAX_BULK_OPERATION_SIZE, DRAW_STATUS_LABELS, formatCurrencyPlain, isDrawEligibleLoan } from "./lib/constants";
import { validateUsDate } from "./lib/dates";
import { calculateMonthlyPaymentDue, getCurrentPrincipalOut } from "./lib/loanCalculations";
import { notifyTeam } from "./lib/notifications";

function getDrawDecisionBody(args: {
  amount: number;
  status: "under_review" | "approved" | "denied";
  propertyAddress?: string;
  wireDate?: string;
  adminNotes?: string;
}) {
  const statusLabel = DRAW_STATUS_LABELS[args.status]?.toLowerCase() ?? args.status;
  const propertyText = args.propertyAddress ? ` for ${args.propertyAddress}` : "";
  const wireText = args.status === "approved" && args.wireDate ? ` Wire date: ${args.wireDate}.` : "";
  const note = args.adminNotes?.trim();
  const noteText = note ? ` Note: ${note}` : "";

  if (args.status === "under_review") {
    return `Your draw request for ${formatCurrencyPlain(args.amount)}${propertyText} is now under review.${noteText}`;
  }

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

export const createManualDrawRequest = mutation({
  args: {
    loanId: v.id("loans"),
    amountRequested: v.number(),
    workDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    const loan = await ctx.db.get(args.loanId);
    if (!loan) throw new ConvexError("Loan not found");
    if (!isDrawEligibleLoan(loan)) {
      throw new ConvexError("Loan is not eligible for draw requests");
    }
    if (!Number.isFinite(args.amountRequested) || args.amountRequested <= 0) {
      throw new ConvexError("Draw amount must be greater than 0");
    }

    const borrower = await ctx.db.get(loan.borrowerId);
    if (!borrower) throw new ConvexError("Borrower not found");

    const trimmedDescription = args.workDescription.trim();
    if (!trimmedDescription) throw new ConvexError("Work description cannot be empty");

    if (loan.drawFundsTotal !== undefined) {
      let pendingTotal = 0;
      for await (const existingDraw of ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", args.loanId))) {
        if (existingDraw.status === "pending" || existingDraw.status === "under_review") {
          pendingTotal += existingDraw.amountRequested;
        }
      }

      const available = loan.drawFundsTotal - (loan.drawFundsUsed ?? 0) - pendingTotal;
      if (args.amountRequested > available) {
        throw new ConvexError(
          `Draw amount exceeds available funds. Available: ${formatCurrencyPlain(Math.max(0, available))}`
        );
      }
    }

    const id = await ctx.db.insert("drawRequests", {
      loanId: args.loanId,
      borrowerId: loan.borrowerId,
      amountRequested: args.amountRequested,
      workDescription: trimmedDescription,
      status: "pending",
    });

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: loan.borrowerId,
      type: "draw_submitted",
      title: "Draw Request Created",
      body: `${admin.displayName} created a draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}.`,
      loanId: args.loanId,
      drawRequestId: id,
      sendSms: true,
    });

    await notifyTeam(ctx, {
      type: "draw_submitted",
      title: "Draw Request Created",
      body: `${admin.displayName} created a draw request for ${borrower.displayName} for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}.`,
      loanId: args.loanId,
      drawRequestId: id,
      details: [
        { label: "Borrower", value: borrower.displayName },
        { label: "Property address", value: loan.propertyAddress },
        { label: "Amount requested", value: formatCurrencyPlain(args.amountRequested) },
        { label: "Work description", value: trimmedDescription },
        { label: "Created by", value: admin.displayName },
      ],
      actionPath: `/dashboard/admin/draws/${id}`,
      actionLabel: "View Draw Request",
      sendSms: true,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "draw.manualCreate",
      entityType: "draw",
      entityId: id,
      details: `Manually created draw request for ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}`,
    });

    return id;
  },
});

export const updateDrawRequest = mutation({
  args: {
    id: v.id("drawRequests"),
    amountRequested: v.number(),
    workDescription: v.string(),
  },
  handler: async (ctx, args) => {
    const admin = await requireRole(ctx, "admin");
    const draw = await ctx.db.get(args.id);
    if (!draw) throw new ConvexError("Draw request not found");
    if (draw.status === "approved" || draw.status === "denied") {
      throw new ConvexError(`Cannot edit a draw request after it has been ${draw.status}`);
    }

    if (!Number.isFinite(args.amountRequested) || args.amountRequested <= 0) {
      throw new ConvexError("Draw amount must be greater than 0");
    }

    const trimmedDescription = args.workDescription.trim();
    if (!trimmedDescription) throw new ConvexError("Work description cannot be empty");

    const loan = await ctx.db.get(draw.loanId);
    if (!loan) throw new ConvexError("Loan not found");

    if (loan.drawFundsTotal !== undefined) {
      let otherPendingTotal = 0;
      for await (const existingDraw of ctx.db
        .query("drawRequests")
        .withIndex("by_loanId", (q) => q.eq("loanId", draw.loanId))) {
        if (existingDraw._id === draw._id) continue;
        if (existingDraw.status === "pending" || existingDraw.status === "under_review") {
          otherPendingTotal += existingDraw.amountRequested;
        }
      }

      const available = loan.drawFundsTotal - (loan.drawFundsUsed ?? 0) - otherPendingTotal;
      if (args.amountRequested > available) {
        throw new ConvexError(
          `Draw amount exceeds available funds. Available: ${formatCurrencyPlain(Math.max(0, available))}`
        );
      }
    }

    await ctx.db.patch(args.id, {
      amountRequested: args.amountRequested,
      workDescription: trimmedDescription,
    });

    await ctx.runMutation(internal.activityLog.log, {
      userId: admin._id,
      userName: admin.displayName,
      action: "draw.update",
      entityType: "draw",
      entityId: args.id,
      details: `Updated draw request from ${formatCurrencyPlain(draw.amountRequested)} to ${formatCurrencyPlain(args.amountRequested)} on ${loan.propertyAddress}`,
    });

    return args.id;
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

    const wireDate = args.wireDate?.trim() || undefined;
    if (args.status === "approved" && !wireDate) {
      throw new ConvexError("Wire date is required to approve draws");
    }
    if (wireDate) validateUsDate(wireDate, "Wire date", { allowFuture: true });

    const results: { drawId: string; success: boolean; error?: string }[] = [];
    const approvedLoanIdsToSync = new Set<Id<"loans">>();

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
      if (args.status === "approved") {
        if (!loan) {
          results.push({ drawId, success: false, error: "Loan not found" });
          continue;
        }
        if (!isDrawEligibleLoan(loan)) {
          results.push({ drawId, success: false, error: "Loan is not eligible for draw requests" });
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
      }

      await ctx.db.patch(drawId, {
        status: args.status,
        adminNotes: args.adminNotes,
        wireDate: args.status === "approved" ? wireDate : undefined,
        reviewedBy: admin._id,
        reviewedAt: Date.now(),
      });

      if (args.status === "approved" && wireDate) {
        await ctx.runMutation(internal.loanCharges.recordDrawProration, {
          loanId: draw.loanId,
          drawRequestId: drawId,
          wireDate,
          createdBy: admin._id,
        });
        approvedLoanIdsToSync.add(draw.loanId);
      }

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
        sendSms: true,
      });

      results.push({ drawId, success: true });
    }

    const successCount = results.filter((r) => r.success).length;
    for (const loanId of approvedLoanIdsToSync) {
      await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
        loanId,
        createdBy: admin._id,
      });
    }

    if (successCount > 0) {
      await notifyTeam(ctx, {
        type: "draw_reviewed",
        title: "Draw Requests " + (DRAW_STATUS_LABELS[args.status] ?? args.status),
        body: `${admin.displayName} bulk ${args.status} ${successCount}/${args.drawIds.length} draw requests.`,
        details: [
          { label: "Updated by", value: admin.displayName },
          { label: "Status", value: DRAW_STATUS_LABELS[args.status] ?? args.status },
          { label: "Successful updates", value: `${successCount}/${args.drawIds.length}` },
        ],
        actionPath: "/dashboard/admin/draws",
        actionLabel: "View Draw Requests",
        sendSms: true,
      });
    }

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
      if (!loan) throw new ConvexError("Loan not found");
      if (!isDrawEligibleLoan(loan)) {
        throw new ConvexError("Loan is not eligible for draw requests");
      }
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
    }

    await ctx.db.patch(args.id, {
      status: args.status,
      adminNotes: args.adminNotes,
      wireDate: args.status === "approved" ? wireDate : undefined,
      reviewedBy: admin._id,
      reviewedAt: Date.now(),
    });

    if (args.status === "approved" && wireDate) {
      await ctx.runMutation(internal.loanCharges.recordDrawProration, {
        loanId: draw.loanId,
        drawRequestId: args.id,
        wireDate,
        createdBy: admin._id,
      });
      await ctx.runMutation(internal.loanCharges.syncInitialInterestCharges, {
        loanId: draw.loanId,
        createdBy: admin._id,
      });
    }

    const [loan, borrower] = await Promise.all([
      ctx.db.get(draw.loanId),
      ctx.db.get(draw.borrowerId),
    ]);
    const borrowerBody = getDrawDecisionBody({
      amount: draw.amountRequested,
      status: args.status,
      propertyAddress: loan?.propertyAddress,
      wireDate,
      adminNotes: args.adminNotes,
    });
    const statusLabel = DRAW_STATUS_LABELS[args.status] ?? args.status;

    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: draw.borrowerId,
      type: "draw_reviewed",
      title: "Draw Request " + statusLabel,
      body: borrowerBody,
      loanId: draw.loanId,
      drawRequestId: args.id,
      sendSms: true,
    });

    await notifyTeam(ctx, {
      type: "draw_reviewed",
      title: "Draw Request " + statusLabel,
      body: `${admin.displayName} marked ${borrower?.displayName ?? "a borrower"}'s draw request for ${formatCurrencyPlain(draw.amountRequested)}${loan ? ` on ${loan.propertyAddress}` : ""} as ${statusLabel}.`,
      loanId: draw.loanId,
      drawRequestId: args.id,
      details: [
        { label: "Borrower", value: borrower?.displayName ?? "Unknown" },
        { label: "Property address", value: loan?.propertyAddress ?? "Unknown" },
        { label: "Amount requested", value: formatCurrencyPlain(draw.amountRequested) },
        { label: "Status", value: statusLabel },
        { label: "Updated by", value: admin.displayName },
        ...(wireDate ? [{ label: "Wire date", value: wireDate }] : []),
      ],
      actionPath: `/dashboard/admin/draws/${args.id}`,
      actionLabel: "View Draw Request",
      sendSms: true,
    });

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
