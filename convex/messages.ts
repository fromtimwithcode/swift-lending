import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireUser } from "./lib/auth";
import { internal } from "./_generated/api";

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);

    // Get all messages where user is sender or recipient
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_senderId", (q) => q.eq("senderId", profile._id))
      .collect();
    const received = await ctx.db
      .query("messages")
      .withIndex("by_recipientId", (q) => q.eq("recipientId", profile._id))
      .collect();

    const allMessages = [...sent, ...received];

    // Dedupe by partner — track latest message per conversation
    const partnerMap = new Map<
      string,
      { partnerId: Id<"userProfiles">; lastMessage: string; lastTime: number }
    >();

    for (const msg of allMessages) {
      const partnerId: Id<"userProfiles"> =
        msg.senderId === profile._id ? msg.recipientId : msg.senderId;

      const existing = partnerMap.get(partnerId);
      if (!existing || msg._creationTime > existing.lastTime) {
        partnerMap.set(partnerId, {
          partnerId,
          lastMessage: msg.content,
          lastTime: msg._creationTime,
        });
      }
    }

    // Count unread per partner
    const unreadCounts = new Map<string, number>();
    for (const msg of received) {
      if (!msg.isRead) {
        const partnerId = msg.senderId;
        unreadCounts.set(partnerId, (unreadCounts.get(partnerId) ?? 0) + 1);
      }
    }

    // Enrich with partner info
    const conversations = await Promise.all(
      Array.from(partnerMap.values()).map(async (conv) => {
        const partner = await ctx.db.get(conv.partnerId);
        return {
          ...conv,
          unread: unreadCounts.get(conv.partnerId) ?? 0,
          partnerName: partner?.displayName ?? "Unknown",
          partnerEmail: partner?.email ?? "",
          partnerRole: partner?.role ?? "",
        };
      })
    );

    return conversations.sort((a, b) => b.lastTime - a.lastTime);
  },
});

export const getDirectMessages = query({
  args: { partnerId: v.id("userProfiles") },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);

    // Use compound indexes to query only messages between the two users
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_senderId_recipientId", (q) =>
        q.eq("senderId", profile._id).eq("recipientId", args.partnerId)
      )
      .collect();
    const received = await ctx.db
      .query("messages")
      .withIndex("by_senderId_recipientId", (q) =>
        q.eq("senderId", args.partnerId).eq("recipientId", profile._id)
      )
      .collect();

    return [...sent, ...received].sort((a, b) => a._creationTime - b._creationTime);
  },
});

export const sendMessage = mutation({
  args: {
    recipientId: v.id("userProfiles"),
    content: v.string(),
    loanId: v.optional(v.id("loans")),
  },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);

    if (!args.content.trim()) throw new Error("Message cannot be empty");

    const id = await ctx.db.insert("messages", {
      senderId: profile._id,
      recipientId: args.recipientId,
      content: args.content,
      loanId: args.loanId,
      isRead: false,
    });

    // Notify recipient
    await ctx.runMutation(internal.notifications.createNotification, {
      recipientId: args.recipientId,
      type: "message_received",
      title: "New Message",
      body: `${profile.displayName} sent you a message.`,
      loanId: args.loanId,
    });

    return id;
  },
});

export const markMessagesRead = mutation({
  args: { messageIds: v.array(v.id("messages")) },
  handler: async (ctx, args) => {
    const profile = await requireUser(ctx);

    if (args.messageIds.length > 50) throw new Error("Maximum 50 items per bulk operation");
    for (const msgId of args.messageIds) {
      const msg = await ctx.db.get(msgId);
      if (msg && msg.recipientId === profile._id && !msg.isRead) {
        await ctx.db.patch(msgId, { isRead: true });
      }
    }
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const profile = await requireUser(ctx);

    // Use compound index to query only unread messages directly
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_recipientId_isRead", (q) =>
        q.eq("recipientId", profile._id).eq("isRead", false)
      )
      .collect();

    return unread.length;
  },
});
