import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireUser } from "./lib/auth";
import { internal } from "./_generated/api";

export const getMyNotifications = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipientId", (q) => q.eq("recipientId", profile._id))
      .order("desc")
      .take(50);
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_isRead", (q) =>
        q.eq("recipientId", profile._id).eq("isRead", false)
      )
      .take(200);
    return unread.length;
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification) throw new Error("Notification not found");
    if (notification.recipientId !== profile._id)
      throw new Error("Not your notification");
    await ctx.db.patch(args.id, { isRead: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_recipientId_and_isRead", (q) =>
        q.eq("recipientId", profile._id).eq("isRead", false)
      )
      .take(200);
    for (const n of unread) {
      await ctx.db.patch(n._id, { isRead: true });
    }
  },
});

export const bulkMarkAsRead = mutation({
  args: {
    notificationIds: v.array(v.id("notifications")),
  },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);
    if (args.notificationIds.length > 50) throw new Error("Maximum 50 items per bulk operation");
    for (const notifId of args.notificationIds) {
      const notification = await ctx.db.get(notifId);
      if (!notification) continue;
      if (notification.recipientId !== profile._id) continue;
      await ctx.db.patch(notifId, { isRead: true });
    }
  },
});

export const createNotification = internalMutation({
  args: {
    recipientId: v.id("userProfiles"),
    type: v.union(
      v.literal("loan_status_changed"),
      v.literal("draw_reviewed"),
      v.literal("application_submitted"),
      v.literal("document_uploaded"),
      v.literal("message_received"),
      v.literal("payment_recorded"),
      v.literal("payment_overdue")
    ),
    title: v.string(),
    body: v.string(),
    loanId: v.optional(v.id("loans")),
    drawRequestId: v.optional(v.id("drawRequests")),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("notifications", {
      ...args,
      isRead: false,
      emailSent: false,
    });

    // Look up recipient email for email notification
    const recipient = await ctx.db.get(args.recipientId);
    if (recipient) {
      await ctx.scheduler.runAfter(0, internal.email.sendNotificationEmail, {
        notificationId: id,
        recipientEmail: recipient.email,
        recipientName: recipient.displayName,
        title: args.title,
        body: args.body,
      });
    }

    return id;
  },
});

export const markEmailSent = internalMutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { emailSent: true });
  },
});
